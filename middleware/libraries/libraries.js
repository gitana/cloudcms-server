var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../../util/util");

/**
 * Handles special formatted thirdparty library requests (for insight.io and gitana.js primarily).
 *
 * @type {Function}
 */
exports = module.exports = function(basePath)
{
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
        return function(req, res, next)
        {
            var uri = req.path;

            if (uri.indexOf("/_lib/") !== 0)
            {
                next();
                return;
            }

            // otherwise, it's a library file

            uri = uri.substring(5);

            var dirPath = "../../web";

            /*
            if (uri == "/gitana/gitana.js" || uri == "/gitana.js")
            {
                // we serve this right from node_modules
                dirPath = "../../node_modules/gitana/lib";
                uri = "/gitana.js";
            }
            */

            //res.header('Cache-Control', "public, max-age=2592000");

            util.sendFile(res, uri, {
                "root": path.join(__dirname, dirPath)
            }, function(err) {

                if (err)
                {
                    // some kind of IO issue streaming back
                    res.send(503, err);
                }

                res.end();

            });
        };
    };

    return r;
};





