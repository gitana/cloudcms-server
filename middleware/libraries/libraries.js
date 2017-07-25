var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../../util/util");

/**
 * Handles special formatted thirdparty library requests (for insight.io and gitana.js primarily).
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var GITANA_JS_PATH = "../../node_modules/gitana/lib";

    if (!fs.existsSync(path.join(__dirname, GITANA_JS_PATH, "gitana.min.js"))) // OK
    {
        GITANA_JS_PATH = path.join("..", "..", GITANA_JS_PATH);
    }

    var ALPACA_JS_PATH = "../../node_modules/alpaca/dist";

    if (!fs.existsSync(path.join(__dirname, ALPACA_JS_PATH, "alpaca", "bootstrap", "alpaca.min.js"))) // OK
    {
        ALPACA_JS_PATH = path.join("..", "..", ALPACA_JS_PATH);
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Supports retrieval of any _lib libraries.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return util.createHandler("lib", function(req, res, next, stores, cache, configuration) {

            var uri = req.path;

            if (uri.indexOf("/_lib/") !== 0)
            {
                return next();
            }

            // otherwise, it's a library file

            uri = uri.substring(5);

            var doGitanaInject = false;
            var dirPath = "../../web";

            // gitana
            if (uri === "/gitana/gitana.js" || uri === "/gitana.js" || uri === "/gitana/gitana.min.js")
            {
                // we serve this right from node_modules
                dirPath = GITANA_JS_PATH;
                uri = "/gitana.js";

                if (req.gitanaConfig)
                {
                    doGitanaInject = true;
                }
            }
            if (doGitanaInject)
            {
                wrapWithGitanaInjection(req, res);

                util.setHeaderOnce(res, "Content-Type", "text/javascript");
            }

            // alpaca
            // this should be "/alpaca/alpaca.min.js" and so on...
            var doAlpacaInject = false;
            if (uri && uri.indexOf("/alpaca/") === 0)
            {
                // assume this for now
                var dialect = "bootstrap";

                // skip ahead "/alpaca/"
                uri = uri.substring(8);

                // we serve this right from node_modules
                dirPath = path.join(ALPACA_JS_PATH, "alpaca", dialect);

                if (uri === "alpaca.js" || uri === "alpaca.min.js")
                {
                    doAlpacaInject = true;
                }
            }
            if (doAlpacaInject)
            {
                wrapWithAlpacaInjection(req, res);

                util.setHeaderOnce(res, "Content-Type", "text/javascript");
            }

            // vendor libraries (provided by alpaca)
            if (uri && uri.indexOf("/vendor/") === 0)
            {
                // skip ahead "/vendor/"
                uri = uri.substring(8);

                // we serve this right from node_modules
                dirPath = path.join(ALPACA_JS_PATH, "lib");
            }


            //util.setHeaderOnce(res, "Pragma", "no-cache");
            util.setHeaderOnce(res, "Cache-Control", "no-cache,no-store,max-age=0,s-maxage=0,must-revalidate");

            if (!uri)
            {
                return res.status(404).end();
            }

            res.sendFile(uri, {
                "root": path.join(__dirname, dirPath)
            }, function(err) {

                if (err)
                {
                    console.log("ERR5: " + err);
                    console.log("ERR5: " + JSON.stringify(err));

                    // some kind of IO issue streaming back
                    try
                    {
                        util.status(res, 503);
                        res.send(err);
                    } catch (e) { }
                    res.end();
                }

            });
        });
    };

    var wrapWithGitanaInjection = function(req, res, next)
    {
        //var _sendFile = res.sendFile;
        var _send = res.send;

        res.sendFile = function(filePath, options, fn)
        {
            var filename = path.basename(filePath);

            // process file and insert CLIENT_KEY into the served gitana driver
            var json = req.gitanaConfig;
            if (json.clientKey)
            {
                // check "cloudcms-server" node modules
                filePath = path.join(__dirname, "..", "..", "node_modules", "gitana", "lib", filename);
                if (!fs.existsSync(filePath)) // OK
                {
                    // check another level up
                    filePath = path.join(__dirname, "..", "..", "..", "..", "node_modules", "gitana", "lib", filename);
                }

                fs.readFile(filePath, function(err, text) { // OK

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
                        // using it for /admin
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

                    util.status(res, 200);
                    _send.call(res, text);

                    fn();
                });
            }
            else
            {
                fn({
                    "message": "Missing json clientKey in gitana config"
                });
            }
        };
    };

    var ALPACA_TEXT_CACHE = {};

    var wrapWithAlpacaInjection = function(req, res, next)
    {
        var _send = res.send;

        res.sendFile = function(filePath, options, fn)
        {
            var gitanaFilePath = path.join(options.root, filePath);

            var text = ALPACA_TEXT_CACHE[gitanaFilePath];
            if (text)
            {
                util.setHeaderOnce(res, "Content-Type", "text/javascript");

                util.status(res, 200);
                return _send.call(res, text);
            }

            fs.readFile(gitanaFilePath, function(err, gitanaText) {

                var appServerPath = path.join(__dirname, "..", "..", "web", "connector", "appserver.js");
                fs.readFile(appServerPath, function(err, appServerText) {

                    var text = gitanaText + appServerText;

                    ALPACA_TEXT_CACHE[gitanaFilePath] = text;

                    util.setHeaderOnce(res, "Content-Type", "text/javascript");

                    util.status(res, 200);
                    _send.call(res, text);

                });
            });
        };
    };


    return r;
}();





