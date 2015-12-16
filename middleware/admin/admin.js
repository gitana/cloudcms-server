var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var Gitana = require("gitana");
var duster = require("../../duster/index");

/**
 * Admin middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var doResetCache = function(host, ref, callback)
    {
        if (ref)
        {
            var z = ref.indexOf("://");

            var type = ref.substring(0, z + 3);
            var identifier = ref.substring(z + 3);

            var parts = identifier.split("/").reverse();

            if (type === "application")
            {
                var applicationId = parts[0];

                // TODO: invalidate any cache dependent on application
                callback();
            }
            else if (type === "node")
            {
                var nodeId = parts[0];
                var branchId = parts[1];
                var repositoryId = parts[2];

                // broadcast invalidation
                process.broadcast.publish("node_invalidation", {
                    "ref": ref,
                    "nodeId": nodeId,
                    "branchId": branchId,
                    "repositoryId": repositoryId,
                    "host": host
                }, function(err) {
                    callback(err);
                });
            }
            else
            {
                callback();
            }
        }
        else
        {
            // do everything for the current host
            var stores = require("../stores/stores");
            stores.produce(host, function (err, stores) {

                if (err) {
                    return callback(err);
                }

                console.log("Admin Controller - Invalidating for hostname: " + host);

                var contentStore = stores.content;

                contentStore.cleanup(function(err) {
                    callback(err);
                });
            });
        }

    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Handles administrative commands.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return function(req, res, next)
        {
            var handled = false;

            var completionFn = function(res, err)
            {
                if (err)
                {
                    res.send({
                        "ok": false,
                        "message": err.message,
                        "err": err
                    });
                    res.end();
                    return;
                }

                // respond with ok
                res.send({
                    "ok": true,
                    "host": host
                });
                res.end();
            };

            if (req.method.toLowerCase() === "post" || req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_admin/cache/reset") === 0)
                {
                    var host = req.domainHost;
                    var ref = req.ref;

                    doResetCache(host, ref, function(err) {
                        completionFn(res, err);
                    });

                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }
        }
    };

    return r;
}();

