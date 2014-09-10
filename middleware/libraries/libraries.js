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
    var GITANA_JS_PATH = "../../node_modules/gitana/lib";

    if (!fs.existsSync(path.join(__dirname, GITANA_JS_PATH, "gitana.js")))
    {
        GITANA_JS_PATH = path.join("..", "..", GITANA_JS_PATH);
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

            if (uri == "/gitana/gitana.js" || uri == "/gitana.js")
            {
                // we serve this right from node_modules
                dirPath = GITANA_JS_PATH;
                uri = "/gitana.js";
            }

            //res.header('Cache-Control', "public, max-age=2592000");

            util.sendFile(res, uri, {
                "root": path.join(__dirname, dirPath)
            }, function(err) {

                if (err)
                {
                    console.log("ERR: " + err);
                    console.log("ERR: " + JSON.stringify(err));

                    // some kind of IO issue streaming back
                    try { res.status(503).send(err); } catch (e) { }
                    res.end();
                }

            });
        };
    };

    return r;
};





