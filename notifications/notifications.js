var async = require("async");
var cluster = require("cluster");

var handleInvalidations = function(items, callback) {

    if (!items) {
        return callback();
    }

    var fns = [];

    for (var i = 0; i < items.length; i++)
    {
        var fn = function(item, i) {
            return function(done) {

                var host = item.host;

                // if virtual hosts not enabled, assume for localhost
                if (!process.configuration.virtualHost || !process.configuration.virtualHost.enabled)
                {
                    host = "localhost";
                }
                else if (process.configuration.virtualHost && process.configuration.virtualHost.enabled)
                {
                    if (!host && item.tenantDnsSlug) {
                        host = item.tenantDnsSlug + ".cloudcms.net";
                    }
                }

                // console.log("Heard: " + host + ", item: " + JSON.stringify(item, null, "  "));

                var operation = item.operation;
                if (operation === "invalidate_object")
                {
                    var type = item.type;

                    if (type === "node")
                    {
                        var ref = item.ref;
                        var nodeId = item.id;
                        var branchId = item.branchId;
                        var repositoryId = item.repositoryId;

                        // TEMP: some legacy support to aid in transition
                        if (!repositoryId || !branchId || !nodeId)
                        {
                            var identifier = ref.substring(ref.indexOf("://") + 3);
                            var parts = identifier.split("/").reverse();

                            nodeId = parts[0];
                            branchId = parts[1];
                            repositoryId = parts[2];
                        }

                        // broadcast invalidation
                        process.broadcast.publish("node_invalidation", {
                            "ref": ref,
                            "nodeId": nodeId,
                            "branchId": branchId,
                            "repositoryId": repositoryId,
                            "isMasterBranch": item.isMasterBranch,
                            "host": host
                        }, function(err) {
                            done(err);
                        });
                    }
                    else
                    {
                        done();
                    }
                }
                else if (operation === "invalidate_objects")
                {
                    var invalidations = item.invalidations;
                    if (invalidations && invalidations.length > 0)
                    {
                        var z_fns = [];
                        for (var z = 0; z < invalidations.length; z++)
                        {
                            var z_fn = function(obj) {
                                return function(z_done) {

                                    var type = obj.type;

                                    if (type === "node")
                                    {
                                        var ref = obj.ref;
                                        var nodeId = obj.id;
                                        var branchId = obj.branchId;
                                        var repositoryId = obj.repositoryId;

                                        // TEMP: some legacy support to aid in transition
                                        if (!repositoryId || !branchId || !nodeId)
                                        {
                                            var identifier = ref.substring(ref.indexOf("://") + 3);
                                            var parts = identifier.split("/").reverse();

                                            nodeId = parts[0];
                                            branchId = parts[1];
                                            repositoryId = parts[2];
                                        }

                                        // broadcast invalidation
                                        process.broadcast.publish("node_invalidation", {
                                            "ref": ref,
                                            "nodeId": nodeId,
                                            "branchId": branchId,
                                            "repositoryId": repositoryId,
                                            "isMasterBranch": obj.isMasterBranch,
                                            "host": host
                                        }, function(err) {
                                            z_done(err);
                                        });
                                    }
                                    else
                                    {
                                        z_done();
                                    }
                                }
                            }(invalidations[z]);
                            z_fns.push(z_fn);
                        }

                        async.series(z_fns, function(err) {
                            done(err);
                        });
                    }
                }
                else if (operation === "invalidate_application")
                {
                    // TODO: invalidate any cache dependent on application
                    done();
                }
                else if (operation === "invalidate_application_page_rendition")
                {
                    var deploymentKey = item.deploymentKey;
                    var applicationId = item.applicationId;

                    var repositoryId = item.repositoryId;
                    var branchId = item.branchId;
                    var isMasterBranch = item.isMasterBranch;

                    // SAFETY CHECK: if no repository and/or branch, just bail
                    if (!repositoryId || !branchId) {
                        console.log("Missing repositoryId or branchId, skipping WCM page invalidation (1)");
                        return done();
                    }

                    var scope = item.scope;
                    var key = item.key;
                    var pageCacheKey = item.pageCacheKey;

                    var message = {
                        "key": key,
                        "scope": scope,
                        "pageCacheKey": pageCacheKey,
                        "applicationId": applicationId,
                        "deploymentKey": deploymentKey,
                        "host": host,
                        "repositoryId": repositoryId,
                        "branchId": branchId,
                        "isMasterBranch": isMasterBranch
                    };

                    var fragmentCacheKey = item.fragmentCacheKey;
                    if (fragmentCacheKey) {
                        message.fragmentCacheKey = fragmentCacheKey;
                    }

                    // broadcast invalidation
                    process.broadcast.publish("invalidate_page_rendition", message, function(err) {
                        done(err);
                    });
                }
                else if (operation === "invalidate_application_page_renditions")
                {
                    var invalidations = item.invalidations;
                    if (invalidations && invalidations.length > 0)
                    {
                        var z_fns = [];
                        for (var z = 0; z < invalidations.length; z++)
                        {
                            var z_fn = function(obj) {
                                return function(z_done) {

                                    var deploymentKey = obj.deploymentKey;
                                    var applicationId = obj.applicationId;

                                    var repositoryId = obj.repositoryId;
                                    var branchId = obj.branchId;
                                    var isMasterBranch = obj.isMasterBranch;

                                    // SAFETY CHECK: if no repository and/or branch, just bail
                                    if (!repositoryId || !branchId) {
                                        console.log("Missing repositoryId or branchId, skipping WCM page invalidation (2)");
                                        return z_done();
                                    }

                                    var scope = obj.scope;
                                    var key = obj.key;
                                    var pageCacheKey = obj.pageCacheKey;

                                    var message = {
                                        "key": key,
                                        "scope": scope,
                                        "pageCacheKey": pageCacheKey,
                                        "applicationId": applicationId,
                                        "deploymentKey": deploymentKey,
                                        "host": host,
                                        "repositoryId": repositoryId,
                                        "branchId": branchId,
                                        "isMasterBranch": isMasterBranch
                                    };

                                    var fragmentCacheKey = obj.fragmentCacheKey;
                                    if (fragmentCacheKey) {
                                        message.fragmentCacheKey = fragmentCacheKey;
                                    }

                                    // broadcast invalidation
                                    process.broadcast.publish("invalidate_page_rendition", message, function(err) {
                                        z_done(err);
                                    });

                                }
                            }(invalidations[z]);
                            z_fns.push(z_fn);
                        }

                        async.series(z_fns, function(err) {
                            done(err);
                        });
                    }
                }
                else if (operation === "invalidate_application_all_page_renditions")
                {
                    var deploymentKey = item.deploymentKey;
                    var applicationId = item.applicationId;
                    var scope = item.scope;

                    var message = {
                        "applicationId": applicationId,
                        "deploymentKey": deploymentKey,
                        "scope": scope,
                        "host": host
                    };

                    // broadcast invalidation
                    process.broadcast.publish("invalidate_all_page_renditions", message, function(err) {
                        done(err);
                    });
                }
            }
        }(items[i], i);
        fns.push(fn);

        async.series(fns, function(err) {
            callback();
        });
    }
};

var runnerFn = function(provider)
{
    var wid = "main";
    if (cluster && cluster.worker) {
        wid = cluster.worker.id;
    }

    provider.process(function(err, items) {

        if (err)
        {
            console.log("[" + wid + "] Broadcast Runner error: " + err, err.stack);

            // start it up again
            runnerFn(provider);

            return;
        }

        if (items && items.length > 0)
        {
            //console.log("[" + wid + "] Broadcast Runner found: " + items.length + " items to work on");

            handleInvalidations(items, function(err) {

                // TODO: what do we do about errors that come back?

                //console.log("[" + wid + "] Broadcast Runner completed work");

                // start it up again
                runnerFn(provider);
            });
        }
        else
        {
            // start it up again
            runnerFn(provider);
        }
    });
};


module.exports = function()
{
    var r = {};

    r.start = function(callback) {

        var config = process.configuration;
        if (!config["notifications"])
        {
            config["notifications"] = {
                "enabled": false,
                "type": "",
                "configuration": {}
            };
        }

        var notifications = config["notifications"];

        if (typeof(process.env.CLOUDCMS_NOTIFICATIONS_ENABLED) !== "undefined")
        {
            if (!process.env.CLOUDCMS_NOTIFICATIONS_ENABLED || process.env.CLOUDCMS_NOTIFICATIONS_ENABLED === "false")
            {
                notifications.enabled = false;
            }
            else if (process.env.CLOUDCMS_NOTIFICATIONS_ENABLED || process.env.CLOUDCMS_NOTIFICATIONS_ENABLED === "true")
            {
                notifications.enabled = true;
            }
        }

        if (notifications.enabled)
        {
            if (process.env.CLOUDCMS_NOTIFICATIONS_TYPE)
            {
                notifications.type = process.env.CLOUDCMS_NOTIFICATIONS_TYPE;
            }

            var type = notifications.type;
            var configuration = notifications.configuration;

            var provider = require("./providers/" + type);
            provider.start(configuration, function(err) {

                if (err)
                {
                    callback(err);
                    return;
                }

                runnerFn(provider);

                callback();
            });
        }
        else
        {
            callback();
        }
    };

    return r;
}();
