var path = require("path");

var NRP = require('node-redis-pubsub-fork');

/**
 * Redis broadcast provider.
 *
 * @type {*}
 */
exports = module.exports = function(broadcastConfig)
{
    var nrp = null;

    var r = {};

    r.start = function(callback)
    {
        var redisPort = broadcastConfig.port;
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_BROADCAST_REDIS_PORT;
        }

        var redisEndpoint = broadcastConfig.endpoint;
        if (typeof(redisEndpoint) === "undefined" || !redisEndpoint)
        {
            redisEndpoint = process.env.CLOUDCMS_BROADCAST_REDIS_ENDPOINT;
        }

        var nrpConfig = {
            "port": redisPort,
            "host": redisEndpoint,
            "scope": "broadcast_cache"
        };

        nrp = new NRP(nrpConfig);

        callback();
    };

    r.publish = function(topic, message, callback)
    {
        nrp.emit(topic, message);

        callback();
    };

    r.subscribe = function(topic, fn, callback)
    {
        nrp.on(topic, fn);

        callback();
    };

    r.unsubscribe = function(topic, fn, callback)
    {
        // NOT IMPLEMENTED
    };

    return r;
};