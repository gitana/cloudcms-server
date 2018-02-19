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
        return util.createInterceptor("serverTags", function(req, res, next, stores, cache, configuration) {

            var webStore = stores.web;

            var doParse = false;
            if (req.path.indexOf(".html") !== -1)
            {
                doParse = true;
            }

            if (doParse)
            {
                if (!req.model) {
                    req.model = {};
                }

                wrapWithDustParser(webStore, req, res, next);

                return next();
            }

            // otherwise, we don't bother
            next();
        });
    };

    var wrapWithDustParser = function(webStore, req, res, next)
    {
        var _sendFile = res.sendFile;
        var _send = res.send;
        var _status = res.status;

        res.sendFile = function(filePath, options, fn)
        {
            // path to the html file
            var fullFilePath = filePath;
            if (options.root) {
                fullFilePath = path.join(options.root, fullFilePath);
            }

            var rebasedPath = webStore.pathWithinStore(filePath);
            if (rebasedPath)
            {
                fullFilePath = rebasedPath;
            }

            // read the file
            webStore.readFile(fullFilePath, function(err, text) {

                if (!text)
                {
                    return _sendFile.call(res, filePath, options, fn);
                }

                text = text.toString();

                /*
                var z = text.indexOf("{@");
                if (z === -1)
                {
                    return _sendFile.call(res, filePath, options, fn);
                }
                */

                var model = req.model;
                if (!model) {
                    model = {};
                }

                duster.execute(req, webStore, fullFilePath, model, function (err, text) {

                    if (err)
                    {
                        // propagate error out to error page
                        return next(err);
                    }

                    _status.call(res, 200);
                    _send.call(res, text);
                });

            });
        };
    };

    return r;
}();

