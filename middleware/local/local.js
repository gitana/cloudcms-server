var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");

/**
 * Local middleware.
 *
 * Serves files back from disk and from the root store.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Supports retrieval of assets from the web store.
     *
     * Files are served from:
     *
     *   <storeRoot>
     *     /<host>
     *       /public
     *
     * @return {Function}
     */
    /*
    r.webStoreHandler = function()
    {
        return util.createHandler("webStore", function(req, res, next, stores, cache, configuration) {

            if (req.virtualFiles)
            {
                var webStore = stores.web;

                // check whether there is a file matching this uri
                var uri = req.path;
                if ("/" === uri) {
                    uri = "/index.html";
                }

                webStore.existsFile(uri, function(exists) {

                    if (exists)
                    {
                        webStore.sendFile(res, uri, function (err) {

                            if (err)
                            {
                                console.log("Web Store Error: " + err);
                                console.log("Web Store Error: " + JSON.stringify(err));

                                util.status(res, 503).end();
                            }

                        });
                    }
                    else
                    {
                        // allow another handler to handle the request
                        next();
                    }
                });
            }
            else
            {
                next();
            }
        });
    };
    */

    /**
     * Fallback content retrieval for typical web paths.
     * Used during development and testing.
     *
     * @return {Function}
     */
    r.defaultHandler = function()
    {
        return util.createHandler("localStore", function(req, res, next, stores, cache, configuration) {

            var webStore = stores.web;

            // check whether there is a file matching this uri
            var filePath = req.path;
            if ("/" === filePath) {
                filePath = "/index.html";
            }

            webStore.existsFile(filePath, function (exists) {

                if (exists)
                {
                    webStore.sendFile(res, filePath, function (err) {

                        if (err)
                        {
                            util.handleSendFileError(req, res, filePath, null, req.log, err);
                        }

                    });
                }
                else
                {
                    next();
                }
            });
        });
    };

    return r;
}();





