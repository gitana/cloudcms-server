var path = require('path');
var fs = require('fs');
var util = require("../../util/util");
var async = require("async");

/**
 * DAV middleware.
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

    var jsDAV = require("jsDAV/lib/jsdav");
    jsDAV.debugMode = true;

    var jsDAV_Locks_Backend_Gitana = require("./locks/gitana");

    /*
    jsDAV.createServer({
        node: __dirname + "/../test/assets",
        locksBackend: jsDAV_Locks_Backend_FS.new(__dirname + "/../test/assets")
    }, 8000);
    */

    var r = {};

    /**
     * Provides DAV handling.
     *
     * @param configuration
     * @return {Function}
     */
    r.davHandler = function()
    {
        return util.createHandler("dav", function(req, res, next, configuation, stores) {

            if (!req.gitana)
            {
                next();
                return;
            }

            if (req.url.search(/^\/webdav/) >= 0) {
                jsDAV.mount({
                        node: __dirname + "/data",
                        mount: "/webdav",
                        server: req.app,
                        standalone: false,
                        locksBackend: jsDAV_Locks_Backend_Gitana.new(req.gitana),
                    }
                ).exec(req, res);
            }
            else
            {
                next();
            }
        });
    };

    return r;
}();

