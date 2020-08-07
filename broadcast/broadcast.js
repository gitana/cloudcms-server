var util = require("../util/util");

module.exports = function()
{
    var provider = null;

    var r = {};

    r.start = function(callback) {

        var self = this;

        // set up defaults
        if (!process.env.CLOUDCMS_BROADCAST_TYPE) {
            process.env.CLOUDCMS_BROADCAST_TYPE = "local";

            if (process.configuration.setup !== "single") {
                process.env.CLOUDCMS_BROADCAST_TYPE = "redis";
            }
        }

        var config = process.configuration;
        if (!config["broadcast"] || !config["broadcast"].type)
        {
            if (process.env.CLOUDCMS_BROADCAST_TYPE) {
                config["broadcast"] = {
                    "enabled": true,
                    "type": process.env.CLOUDCMS_BROADCAST_TYPE,
                    "configuration": {}
                };
            }
        }
        if (config["broadcast"])
        {
            var broadcast = config["broadcast"];

            if (broadcast.enabled)
            {
                var type = broadcast.type;
                var configuration = broadcast.configuration;
                if (!configuration) {
                    configuration = broadcast.config;
                }

                process.env.CLOUDCMS_BROADCAST_TYPE = type;

                provider = require("./providers/" + type)(configuration);
                provider.start(function (err) {
                    return callback(err);
                });
            }
            else
            {
                callback();
            }
        }
        else
        {
            callback();
        }
    };

    r.publish = function(topic, message, callback)
    {
        if (!provider) {
            return;
        }

        if (!message) {
            message = {};
        }

        if (!message.id) {
            message.id = util.guid();
        }

        provider.publish(topic, message, function(err) {

            if (callback)
            {
                callback(err);
            }

        });
    };

    r.subscribe = function(topic, fn, callback)
    {
        if (!provider) {
            return;
        }

        provider.subscribe(topic, fn, function(err) {

            if (callback)
            {
                callback(err);
            }

        });
    };

    r.unsubscribe = function(topic, fn, callback)
    {
        if (!provider) {
            return;
        }

        provider.unsubscribe(topic, fn, function(err) {

            if (callback)
            {
                callback();
            }
        });
    };

    return r;
}();
