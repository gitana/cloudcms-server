var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../../util/util");

var duster = require("../../duster/index");


/**
 * Server Tags Middleware.
 *
 * Performs variable and token substitution on some text files that find themselves being served.
 * This includes any HTML file and the gitana.js driver.
 */
exports = module.exports = function()
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.interceptor = function()
    {
        return util.createInterceptor("serverTags", function(req, res, next, configuration, stores) {

            var webStore = stores.web;

            var doParse = false;
            if (req.path.indexOf(".html") !== -1)
            {
                doParse = true;
            }

            if (doParse)
            {
                wrapWithDustParser(webStore, req, res);
                next();
                return;
            }

            // otherwise, we don't bother
            next();
        });
    };

    var wrapWithDustParser = function(webStore, req, res)
    {
        var _sendFile = res.sendFile;
        var _send = res.send;

        res.sendFile = function(filePath, options, fn)
        {
            // path to the html file
            var fullFilePath = filePath;
            if (options.root) {
                fullFilePath = path.join(options.root, fullFilePath);
            }

            // read the file
            webStore.readFile(fullFilePath, function(err, text) {

                if (!text)
                {
                    _sendFile.call(res, filePath, options, fn);
                    return;
                }
                text = text.toString();
                var z = text.indexOf("{@");
                if (z === -1)
                {
                    _sendFile.call(res, filePath, options, fn);
                    return;
                }
                var model = {};
                duster.execute(req, webStore, fullFilePath, model, function(err, text) {

                    if (err)
                    {
                        // use the original method
                        _sendFile.call(res, filePath, options, fn);
                    }
                    else
                    {
                        _send.call(res, 200, text);
                    }
                });

            });
        };
    };

    return r;
}();

