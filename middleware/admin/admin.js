var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");

var auth = require('basic-auth');

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
    
            var type = ref.substring(0, z);
            var identifier = ref.substring(z + 3);

            var parts = identifier.split("/").reverse();
            
            if (type === "node")
            {
                var nodeId = parts[0];
                var branchId = parts[1];
                var repositoryId = parts[2];

                // broadcast invalidation
                process.log("admin broadcasting node invalidation. ref: " + ref);
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
                process.log("admin NOT broadcasting. Event is not a node invalidation. ref: " + ref);
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

                process.log("Admin Controller - Invalidating for hostname: " + host);

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
        return util.createHandler("admin", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            var completionFn = function(host, res, err)
            {
                if (err)
                {
                    res.send({
                        "ok": false,
                        "message": err.message,
                        "err": err
                    });
                    return res.end();
                }

                // respond with ok
                res.json({
                    "ok": true,
                    "host": host
                });
                res.end();
            };

            var assertAuthenticated = function(req, res, callback)
            {
                if (configuration.username && configuration.password)
                {
                    var credentials = auth(req);

                    if (!credentials || credentials.name !== configuration.username || credentials.pass !== configuration.password)
                    {
                        res.statusCode = 401;
                        util.setHeader(res, 'WWW-Authenticate', 'Basic realm="admin"');
                        res.end('Admin access denied');
                        return;
                    }
                }

                callback();
            };

            if (req.method.toLowerCase() === "post" || req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_admin/cache/reset") === 0 || req.url.indexOf("/_admin/cache/invalidate") === 0)
                {
                    assertAuthenticated(req, res, function() {

                        doResetCache(req.virtualHost, req.query.ref, function(err) {
                            completionFn(req.virtualHost, res, err);
                        });

                    });

                    handled = true;
                }
            }

            if (req.method.toLowerCase() === "post" || req.method.toLowerCase() === "get") {
                
                if (req.url.indexOf("/_admin/driverconfigcache/reset") === 0 || req.url.indexOf("/_admin/driverconfigcache/invalidate") === 0)
                {
                    assertAuthenticated(req, res, function() {

                        process.driverConfigCache.invalidate(req.virtualHost, function (err) {
                            completionFn(req.virtualHost, res, err);
                        });

                    });

                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }
        });
    };

    return r;
}();

