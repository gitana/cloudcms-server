var async = require("async");
var cluster = require("cluster");

var handleInvalidations = function(items, callback) {

    if (!items) {
        return callback();
    }

    // do a little trick here to merge identical items so that we have less to work on
    //console.log("ITEMS SIZE WAS: " + items.length);
    var map = {};
    var i = 0;
    while (i < items.length)
    {
        var item = items[i];

        var key = item.type + "_" + item.ref + "_" + item.operation;

        if (map[key])
        {
            items.splice(i, 1);
        }
        else
        {
            map[key] = true;
            i++;
        }
    }
    map = null;
    //console.log("ITEMS SIZE IS: " + items.length);

    var fns = [];

    for (var i = 0; i < items.length; i++)
    {
        var fn = function(item, i) {
            return function(done) {

                var type = item.type;
                var ref = item.ref;
                var operation = item.operation;

                var identifier = ref.substring(ref.indexOf("://") + 3);
                var parts = identifier.split("/").reverse();

                if (operation === "invalidate_object")
                {
                    if (type === "node")
                    {
                        var nodeId = parts[0];
                        var branchId = parts[1];
                        var repositoryId = parts[2];

                        // broadcast invalidation
                        process.broadcast.publish("node_invalidation", {
                            "ref": ref,
                            "nodeId": nodeId,
                            "branchId": branchId,
                            "repositoryId": repositoryId
                        }, function(err) {
                            done(err);
                        });
                    }
                    else
                    {
                        done();
                    }
                }
                else if (operation === "invalidate_application")
                {
                    // TODO: invalidate any cache dependent on application
                    done();
                }
                else if (operation === "invalidate_application_page_rendition")
                {
                    //var pageRenditionId = parts[0];
                    var deploymentKey = parts[1];
                    var applicationId = parts[2];

                    var repositoryId = item.repositoryId;
                    var branchId = item.branchId;
                    if (item.isMasterBranch)
                    {
                        branchId = "master";
                    }
                    var scope = item.scope;
                    var key = item.key;
                    var pageCacheKey = item.pageCacheKey;

                    var message = {
                        "key": key,
                        "scope": scope,
                        "pageCacheKey": pageCacheKey,
                        "branchId": branchId,
                        "repositoryId": repositoryId,
                        "applicationId": applicationId,
                        "deploymentKey": deploymentKey
                    };

                    var fragmentCacheKey = item.fragmentCacheKey;
                    if (fragmentCacheKey) {
                        message.fragmentCacheKey = fragmentCacheKey;
                    }

                    // broadcast invalidation
                    process.broadcast.publish("page_rendition_invalidation", message, function(err) {
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
            console.log("[" + wid + "] Broadcast Runner found: " + items.length + " items to work on");

            handleInvalidations(items, function(err) {

                // TODO: what do we do about errors that come back?

                console.log("[" + wid + "] Broadcast Runner completed work");

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
