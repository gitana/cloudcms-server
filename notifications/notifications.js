var async = require("async");
var cluster = require("cluster");

var determineHost = function(item, obj)
{
    var host = null;

    // if virtual hosts aren't enabled, then host is the standalone host ("local")
    if (!process.configuration.virtualHost || !process.configuration.virtualHost.enabled)
    {
        host = process.env.CLOUDCMS_STANDALONE_HOST;
    }
    else
    {
        // assume host if specified on the item
        host = item.host;

        // if not specified on the item, assume value imputed based on virtual host being activ
        if (process.configuration.virtualHost && process.configuration.virtualHost.enabled)
        {
            if (!host && item.tenantDnsSlug)
            {
                host = item.tenantDnsSlug + ".cloudcms.net";
            }
        }

        // if we have an object, maybe we can use thaT?
        if (!host && obj)
        {
            host = obj.host;

            if (process.configuration.virtualHost && process.configuration.virtualHost.enabled)
            {
                if (!host && obj.tenantDnsSlug)
                {
                    host = obj.tenantDnsSlug + ".cloudcms.net";
                }
            }
        }
    }

    return host;
};

var handleNotificationMessages = function(items, callback) {

    if (!items) {
        return callback();
    }

    // wrap the processing of each item into a series function
    var fns = [];
    for (var i = 0; i < items.length; i++)
    {
        var fn = function(item, i) {
            return function(done) {

                // console.log("WORKING ON ITEM: " + i + ", item: " + JSON.stringify(item, null, "  "));

                var operation = item.operation;

                /**
                 * @deprecated support for "invalidate_object"
                 * This is left in to support legacy installations of the API that are still doing things object-by-object.
                 * Newer API versions do bulk operations and use the "invalidate_objects" notification event.
                 *
                 * This will be removed at some point in the future.  Please upgrade to the latest Cloud CMS API.
                 */
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

                        var host = determineHost(item);

                        var paths = item.paths || {};

                        // broadcast invalidation
                        process.broadcast.publish("node_invalidation", {
                            "ref": ref,
                            "nodeId": nodeId,
                            "branchId": branchId,
                            "repositoryId": repositoryId,
                            "isMasterBranch": item.isMasterBranch,
                            "host": host,
                            "paths": paths
                        }, function(err) {
                            return done(err);
                        });
                    }
                    else
                    {
                        return done();
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
                            var z_fn = function(item, obj, z) {
                                return function(z_done) {

                                    var host = determineHost(item, obj);

                                    var type = obj.type;

                                    if (type === "node")
                                    {
                                        var ref = obj.ref;
                                        var nodeId = obj.id;
                                        var branchId = obj.branchId;
                                        var repositoryId = obj.repositoryId;

                                        var paths = obj.paths || {};

                                        // TEMP: some legacy support to aid in transition
                                        if (!repositoryId || !branchId || !nodeId)
                                        {
                                            var identifier = ref.substring(ref.indexOf("://") + 3);
                                            var parts = identifier.split("/").reverse();

                                            nodeId = parts[0];
                                            branchId = parts[1];
                                            repositoryId = parts[2];
                                        }

                                        console.log("Sending node invalidation for host: " + host);

                                        // broadcast invalidation
                                        process.broadcast.publish("node_invalidation", {
                                            "ref": ref,
                                            "nodeId": nodeId,
                                            "branchId": branchId,
                                            "repositoryId": repositoryId,
                                            "isMasterBranch": obj.isMasterBranch,
                                            "host": host,
                                            "paths": paths
                                        }, z_done);
                                    }
                                    else if (type === "settings")
                                    {
                                        var ref = obj.ref;
                                        var settingsKey = obj.settingsKey;
                                        var settingsScope = obj.settingsScope;

                                        // broadcast invalidation
                                        process.broadcast.publish("settings_invalidation", {
                                            "ref": ref,
                                            "settingsKey": settingsKey,
                                            "settingsScope": settingsScope,
                                            "host": host
                                        }, z_done);
                                    }
                                    else if (type === "application")
                                    {
                                        var ref = obj.ref;
                                        var applicationId = obj.applicationId;
                                        var deploymentKey = obj.deploymentKey;
                                        var stackId = obj.stackId;
                                        var stackMembers = obj.stackMembers;

                                        process.broadcast.publish("application_invalidation", {
                                            "ref": ref,
                                            "applicationId": applicationId,
                                            "deploymentKey": deploymentKey,
                                            "host": host,
                                            "stackId": stackId,
                                            "stackMembers": stackMembers
                                        });

                                        z_done();
                                    }
                                    else if (type === "uiconfig")
                                    {
                                        var ref = obj.ref;
                                        var id = obj.id;

                                        // broadcast invalidation
                                        process.broadcast.publish("uiconfig_invalidation", {
                                            "ref": ref,
                                            "id": id,
                                            "host": host
                                        }, z_done);
                                    }

                                    else
                                    {
                                        z_done();
                                    }
                                }
                            }(item, invalidations[z], z);
                            z_fns.push(z_fn);
                        }

                        async.series(z_fns, function(err) {
                            return done(err);
                        });
                    }
                    else
                    {
                        return done();
                    }
                }
                else if (operation === "invalidate_application")
                {
                    // TODO: invalidate any cache dependent on application
                    return done();
                }
                else if (operation === "invalidate_application_page_rendition")
                {
                    var deploymentKey = item.deploymentKey;
                    var applicationId = item.applicationId;

                    var repositoryId = item.repositoryId;
                    var branchId = item.branchId;
                    var isMasterBranch = item.isMasterBranch;

                    var host = determineHost(item);

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
                        return done(err);
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
                            var z_fn = function(item, obj) {
                                return function(z_done) {

                                    var deploymentKey = obj.deploymentKey;
                                    var applicationId = obj.applicationId;

                                    var repositoryId = obj.repositoryId;
                                    var branchId = obj.branchId;
                                    var isMasterBranch = obj.isMasterBranch;

                                    var host = determineHost(item, obj);

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
                            }(item, invalidations[z]);
                            z_fns.push(z_fn);
                        }

                        async.series(z_fns, function(err) {
                            return done(err);
                        });
                    }
                }
                else if (operation === "invalidate_application_all_page_renditions")
                {
                    var deploymentKey = item.deploymentKey;
                    var applicationId = item.applicationId;
                    var scope = item.scope;

                    var host = determineHost(item);

                    var message = {
                        "applicationId": applicationId,
                        "deploymentKey": deploymentKey,
                        "scope": scope,
                        "host": host
                    };

                    // broadcast invalidation
                    process.broadcast.publish("invalidate_all_page_renditions", message, function(err) {
                        return done(err);
                    });
                }
                else
                {
                    console.log("Unknown notification item: " + item.rawMessage);

                    // just assume it's something we can't deal with
                    return done({
                        "message": "Unknown notification item: " + item.rawMessage
                    });
                }
            }
        }(items[i], i);
        fns.push(fn);
    }

    // run all of the functions in series
    async.series(fns, function(err) {
        callback(err);
    });
};

var completeRunnerFn = function(provider, printStartMessage)
{
    return runnerFn(provider, printStartMessage);
};

var runnerCount = 0;
var runnerFn = function(provider, printStartMessage)
{
    var wid = "main";
    if (cluster && cluster.worker)
    {
        wid = cluster.worker.id;
    }

    var runner = function(provider, runnerCount, wid, printStartMessage)
    {
        return function() {

            if (printStartMessage)
            {
                console.log("[" + wid + "][" + runnerCount + "] Starting notifications loop");
            }

            provider.process(function(err, items, postHandleCallback) {

                if (err)
                {
                    console.log("[" + wid + "][" + runnerCount + "] Notification Provider error: " + err, err.stack);

                    // start it up again
                    return completeRunnerFn(provider);
                }

                if (!items) {
                    items = [];
                }

                if (items.length === 0)
                {
                    // start it up again
                    return completeRunnerFn(provider, false);
                }

                console.log("[" + wid + "][" + runnerCount + "] Notification Provider found: " + items.length + " notification items");

                handleNotificationMessages(items, function (err) {

                    console.log("[" + wid + "][" + runnerCount + "] Notification Provider handled: " + items.length + " items");

                    postHandleCallback(err, items, function (err, items, deletedItems) {

                        console.log("[" + wid + "][" + runnerCount + "] Notification Provider completed - handled: " + items.length + ", deleted: " + deletedItems.length);

                        // start it up again
                        return completeRunnerFn(provider, true);

                    });
                });
            });
        }  ;
    }(provider, runnerCount++, wid, printStartMessage);

    setTimeout(runner, 500);
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
                    return callback(err);
                }

                // this starts the "thread" for the provider listener
                runnerFn(provider, true);

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
