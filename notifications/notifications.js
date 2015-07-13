var TIMEOUT = 2500;

var handleInvalidations = function(items, callback) {

    if (items)
    {
        for (var i = 0; i < items.length; i++)
        {
            var type = items[i].type;

            var ref = items[i].ref;
            var identifier = ref.substring(ref.indexOf("://") + 3);
            var parts = identifier.split("/");

            if (items[i].operation === "invalidate_object")
            {
                if (type === "node")
                {
                    var nodeId = parts.reverse()[0];
                    var branchId = parts.reverse()[1];
                    var repositoryId = parts.reverse()[2];

                    if (items[i].isMasterBranch)
                    {
                        branchId = "master";
                    }

                    // manually perform cloudcms invalidation
                    //var cloudcms = require("../middleware/cloudcms/cloudcms");
                    //cloudcms.invalidateNode(repositoryId, branchId, nodeId, function() {
                    //    console.log("Invalidate Cloud CMS node completed");
                    //});

                    // broadcast invalidation
                    process.broadcast.publish("node_invalidation", {
                        "ref": ref,
                        "nodeId": nodeId,
                        "branchId": branchId,
                        "repositoryId": repositoryId
                    });
                }
            }
            else if (items[i].operation === "invalidate_application")
            {
                // TODO: invalidate any cache dependent on application
            }
        }
    }

    callback();
};

var runnerFn = function(provider)
{
    provider.process(function(err, items) {

        if (err)
        {
            console.log("ERR: " + err, err.stack);

            setTimeout(function() {
                runnerFn(provider);
            }, TIMEOUT);

            return;
        }

        if (items)
        {
            handleInvalidations(items, function () {

                setTimeout(function() {
                    runnerFn(provider);
                }, TIMEOUT);
            });
        }
        else
        {
            setTimeout(function() {
                runnerFn(provider);
            }, TIMEOUT);
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

        if (process.env.CLOUDCMS_NOTIFICATIONS_ENABLED)
        {
            notifications.enabled = true;
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
