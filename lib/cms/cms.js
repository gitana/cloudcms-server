var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("util");

var mkdirp = require('mkdirp');

var Gitana = require('gitana');

var localeUtil = require("../util/locale");

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);

    var cloudcmsUtil = require("../util/cloudcms")(basePath);

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.interceptor = function()
    {
        /**
         * Looks at the HTML and finds any dom elements marked up with the following attributes:
         *
         *   data-field-id              <the id of the field in the json structure to be stored>
         *   data-field-title           <the title of the field to be shown on form>
         *   data-field-type            <the json schema type for the field>
         *
         * If found, then the appropriate value is substituted into the dom element.
         *
         * @param html
         */
        var processTags = function(html)
        {
            return html;
        };

        /**
         * Adds in the authoring tools.
         *
         * @param html
         */
        var injectScript = function(html, scriptPath)
        {
            var toInject = "<script src='" + scriptPath + "'></script>";
            var i = html.indexOf("</head>");
            if (i > -1)
            {
                html = html.substring(0,i) + toInject + html.substring(i);
            }

            return html;
        };

        /**
         * Adds in the model for debug.
         *
         * @param html
         */
        var injectModelDebug = function(html, model)
        {
            var text = JSON.stringify(model, null, "   ");

            var toInject = "\r<!-- CLOUD_CMS_DEBUG_MODEL -->\r<!--\r" + text + "\r-->\r<!-- END CLOUD_CMS_DEBUG_MODEL -->\r";
            var i = html.indexOf("</body>");
            if (i > -1)
            {
                html = html.substring(0,i) + toInject + html.substring(i);
            }

            return html;
        };

        /**
         * Loads and assembles the Cloud CMS model for automatic server-side template processing using handlebars.
         *
         * @param req
         * @param filePath
         * @param callback
         */
        var loadModel = function(req, filePath, callback)
        {
            var gitana = req.gitana;
            var host = req.virtualHost;
            var repositoryId = req.repositoryId;
            var branchId = cloudcmsUtil.determineBranchId(req);
            var locale = localeUtil.determineLocale(req);
            //var attachmentId = "default";
            var attachmentId = null;
            var offsetPath = filePath;
            var forceReload = true;

            if ("/" === offsetPath) {
                offsetPath = "/index.html";
            }
            if (offsetPath.indexOf("/") == 0) {
                offsetPath = offsetPath.substring(1);
            }
            offsetPath = "/applications/" + req.applicationId + "/pages/" + offsetPath + ".json";

            cloudcmsUtil.download(host, gitana, repositoryId, branchId, "root", attachmentId, offsetPath, locale, forceReload, function(err, filePath) {

                // if the file was found on disk or was downloaded, then stream it back
                if (!err && filePath)
                {
                    // load...
                    var contents = fs.readFileSync(filePath);
                    var model = JSON.parse(contents).model;

                    // store onto request
                    req.model = model;

                    // hand back
                    callback(null, model);
                }
                else
                {
                    callback();
                }
            });

            /*
            var model = {
                "candidates": [{
                    "firstName": "Michael",
                    "lastName": "Uzquiano",
                    "degree": "PHD",
                    "school": "ENGR"
                },{
                    "firstName": "Tony",
                    "lastName": "Uzquiano",
                    "degree": "MS",
                    "school": "MATH"
                },{
                    "firstName": "Ken",
                    "lastName": "Uzquiano",
                    "degree": "BS",
                    "school": "ART"
                }],
                "intro": "HI"
            };

            callback(null, model);
            */
        };

        return function(req, res, next)
        {
            next();
            return;

            // wrap the res.render function
            // this allows us to peek at HTML that flows back and plug in additional tags

            var _sendfile = res.sendfile;
            var _send = res.send;

            res.sendfile = function(filePath, options, fn)
            {
                var filename = path.basename(filePath);

                // is it an HTML file that we should consider parsing?
                var parsable = true;
                if (filePath.indexOf(".html") == -1)
                {
                    parsable = false;
                }
                if (filePath.indexOf("/components/") > -1)
                {
                    parsable = false;
                }
                if (filePath.indexOf("/app/") > -1)
                {
                    parsable = false;
                }
                if (filePath.indexOf("/templates/") > -1)
                {
                    parsable = false;
                }

                // if it's something we can parse...
                if (parsable)
                {
                    //
                    // for HTML files, we load them via use of an Express template engine
                    // the template engine retrieves off disk, applies our model and evaluates the script
                    // and then hands us back the finished HTML
                    //
                    // once we get the HTML back, we do some late injections of any SCRIPT tags we want to have
                    // included on the page for authoring mode operations (preview + ice)
                    //

                    // build the full path to the template file (sans the extension which is always .html)
                    var templatePath = filePath;
                    if (options.root) {
                        templatePath = path.join(options.root, templatePath);
                    }
                    var x = templatePath.lastIndexOf(".");
                    templatePath = templatePath.substring(0, x);

                    // load our model from Cloud CMS
                    // if one doesn't exist, that's fine
                    loadModel(req, filePath, function(err, model) {

                        // if we get an err back, it means there was some kind of IO issue...
                        if (err)
                        {
                            fn(err);
                            return;
                        }

                        // if no model, use an empty model
                        if (!model) {
                            model = {};
                        }

                        // now render using the express template engine
                        // by default, this is configured to be handlebars
                        res.render(templatePath, model, function(err, html) {

                            if (err)
                            {
                                // some kind of io error?
                                // could also be a template parsing error...
                                fn(err);
                                return;
                            }

                            // now we have the transformed HTML...

                            // ensure we have it as a string (not a buffer)
                            html = "" + html;

                            // process any tags
                            html = processTags(html);

                            // inject the preview adapter
                            html = injectScript(html, "/_lib/cms/preview.js");

                            // inject the in-context editor
                            // only if we're in ice mode
                            if (req.ice)
                            {
                                html = injectScript(html, "/_lib/cms/ice.js");
                            }

                            html = injectModelDebug(html, model);

                            //res.send(200, html);
                            _send.call(res, 200, html);

                            fn();

                        });

                    });
                }
                else if (filename == "gitana.js" || filename == "gitana.min.js")
                {
                    // check for the "gitana.json" file
                    // either in process root or in virtual host path
                    //var gitanaJsonPath = path.join(process.cwd(), "gitana.json");
                    var gitanaJsonPath = "./gitana.json";
                    if (req.virtualHost)
                    {
                        gitanaJsonPath = path.join(storage.hostDirectoryPath(req.virtualHost), "gitana.json");
                    }
                    else if (process.env.CLOUDCMS_GITANA_JSON_PATH)
                    {
                        gitanaJsonPath = process.env.CLOUDCMS_GITANA_JSON_PATH;
                    }
                    fs.readFile(gitanaJsonPath, function(err, text) {

                        if (err) {
                            // not there, just continue
                            next();
                            return;
                        }

                        // parse
                        var json = JSON.parse(text);
                        if (json.clientKey)
                        {
                            if (options.root) {
                                filePath = path.join(options.root, filePath);
                            }
                            fs.readFile(filePath, function(err, text) {

                                if (err)
                                {
                                    fn(err);
                                    return;
                                }

                                text = "" + text;

                                var ick = "Gitana.__INSERT_MARKER = null;";

                                var i1 = text.indexOf(ick);
                                if (i1 > -1)
                                {
                                    var i2 = i1 + ick.length;

                                    var config = {
                                        "clientKey": json.clientKey
                                    };
                                    if (json.clientSecret) {
                                        config.clientSecret = json.clientSecret;
                                    }
                                    if (json.application) {
                                        config.application = json.application;
                                    }

                                    // append in the default config settings
                                    var itext = "";
                                    itext += "/** INSERTED BY CLOUDCMS-NET SERVER **/";
                                    itext += "Gitana.autoConfigUri = false;";
                                    itext += "Gitana.loadDefaultConfig = function() {";
                                    itext += "   return " + JSON.stringify(config, null, "   ") + ";";;
                                    itext += "};";
                                    itext += "/** END INSERTED BY CLOUDCMS-NET SERVER **/";

                                    text = text.substring(0, i1) + itext + text.substring(i2);
                                }

                                //res.send(200, html);
                                _send.call(res, 200, text);

                                fn();
                            });
                        }
                        else
                        {
                            next();
                        }
                    });
                }
                else
                {
                    // use the original method
                    return _sendfile.call(res, filePath, options, fn);
                }
            };

            next();
        };
    };

    return r;
};

