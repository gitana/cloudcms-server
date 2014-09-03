var path = require('path');
var fs = require('fs');
var http = require('http');

var mkdirp = require('mkdirp');

var duster = require("../../duster");


/**
 * TextOut Middleware.
 *
 * Performs variable and token substitution on some text files that find themselves being served.
 * This includes any HTML file and the gitana.js driver.
 */
exports = module.exports = function(basePath)
{
    var areServerTagsEnabled = function(configuration)
    {
        var enabled = false;

        if (configuration && configuration.serverTags)
        {
            if (typeof(configuration.serverTags.enabled) != "undefined")
            {
                enabled = configuration.serverTags.enabled;
            }
        }

        return enabled;
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.interceptor = function(configuration)
    {
        return function(req, res, next)
        {
            // wrap the res.render function
            // this allows us to peek at HTML that flows back and plug in additional tags

            var _sendFile = res.sendFile;
            var _send = res.send;

            res.sendFile = function(filePath, options, fn)
            {
                var filename = path.basename(filePath);

                var parsable = false;
                if (areServerTagsEnabled(configuration))
                {
                    if (filePath.indexOf(".html") !== -1)
                    {
                        parsable = true;
                    }
                }

                // if it's something we can parse...
                if (parsable)
                {
                    // path to the html file
                    var fullFilePath = filePath;
                    if (options.root) {
                        fullFilePath = path.join(options.root, fullFilePath);
                    }

                    duster.execute(req, fullFilePath, function(err, out) {

                        if (err)
                        {
                            // use the original method
                            _sendFile.call(res, filePath, options, fn);
                        }
                        else
                        {
                            _send.call(res, 200, out);
                        }
                    });
                }

                // if they request "gitana.js", we plug in client key info
                else if (filePath == "/gitana/gitana.js" || filePath == "/gitana/gitana.min.js")
                {
                    if (!req.gitanaConfig)
                    {
                        // serve the file straight away, no processing
                        _sendFile.call(res, filePath, options, fn);
                    }
                    else
                    {
                        // process file and insert CLIENT_KEY into the served gitana driver
                        var json = req.gitanaConfig;
                        if (json.clientKey)
                        {
                            // check "cloudcms-server" node modules
                            filePath = path.join(__dirname, "..", "..", "node_modules", "gitana", "lib", filename);
                            if (!fs.existsSync(filePath))
                            {
                                // check another level up
                                filePath = path.join(__dirname, "..", "..", "..", "..", "node_modules", "gitana", "lib", filename);
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
                                    // NO, this does not get handed back
                                    // FOR NOW, hand back because the Apache proxy doesn't auto-insert and we're still
                                    // using it for /console
                                    //if (json.clientSecret) {
                                    //    config.clientSecret = json.clientSecret;
                                    //}
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

                                _send.call(res, 200, text);

                                fn();
                            });
                        }
                        else
                        {
                            fn({
                                "message": "Missing json clientKey in gitana config"
                            });
                            return;
                        }
                    }
                }
                else
                {
                    // BUG: there appears to be an issue with Express whereby an empty file returns a 503
                    // we want it to return a 200
                    // so here we check for file size
                    var fullFilePath = filePath;
                    if (options.root) {
                        fullFilePath = path.join(options.root, fullFilePath);
                    }
                    fullFilePath = path.normalize(fullFilePath);
                    var exists = fs.existsSync(fullFilePath);
                    if (!exists)
                    {
                        res.send(404);
                        return;
                    }
                    var stats = fs.statSync(fullFilePath);
                    if (stats.size == 0)
                    {
                        res.status(200).send("");
                        return;
                    }

                    // use the original method
                    return _sendFile.call(res, filePath, options, fn);
                }
            };

            next();
        };
    };

    return r;
};

