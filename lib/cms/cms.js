var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("util");

var mkdirp = require('mkdirp');

var Gitana = require('gitana');

var localeUtil = require("../util/locale");

var dust = require("dustjs-linkedin");
require('dustjs-helpers');
require("./dusthelpers")(dust);


exports = module.exports = function(basePath)
{
    var populateContext = function(context)
    {
        // TODO: populate user information
        context.user = {
            "name": "user@user.com",
            "firstName": "First Name",
            "lastName": "Last Name",
            "email": "user@email.com"
        };
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.interceptor = function()
    {
        return function(req, res, next)
        {
            // wrap the res.render function
            // this allows us to peek at HTML that flows back and plug in additional tags

            var _sendfile = res.sendfile;
            var _send = res.send;

            res.sendfile = function(filePath, options, fn)
            {
                var filename = path.basename(filePath);

                var parsable = false;
                if (filePath.indexOf(".html") !== -1)
                {
                    parsable = true;
                }

                // if it's something we can parse...
                if (parsable)
                {
                    // path to the html file
                    var templatePath = filePath;
                    if (options.root) {
                        templatePath = path.join(options.root, templatePath);
                    }

                    // load the contents of the file
                    // make sure this is text
                    if (!dust.cache[templatePath])
                    {
                        var html = "" + fs.readFileSync(templatePath);

                        // compile
                        var compiledTemplate = dust.compile(html, filePath);
                        dust.loadSource(compiledTemplate);
                    }

                    // build context
                    var context = {};
                    populateContext(context);

                    // execute template
                    dust.render(filePath, context, function(err, out) {
                        _send.call(res, 200, out);
                    });
                }

                // if they request "gitana.js", we plug in client key info
                else if (filename == "gitana.js" || filename == "gitana.min.js")
                {
                    // check for the "gitana.json" file
                    // either in process root or in virtual host path
                    //var gitanaJsonPath = path.join(process.cwd(), "gitana.json");
                    var gitanaJsonPath = "./gitana.json";
                    if (req.virtualHostGitanaJsonPath)
                    {
                        gitanaJsonPath = req.virtualHostGitanaJsonPath;
                    }
                    else if (process.env.CLOUDCMS_GITANA_JSON_PATH)
                    {
                        gitanaJsonPath = process.env.CLOUDCMS_GITANA_JSON_PATH;
                    }

                    console.log("Gitana JSON Path: " + gitanaJsonPath);

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

