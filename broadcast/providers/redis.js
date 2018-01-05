var path = require("path");

var NRP = require('node-redis-pubsub');

var logFactory = require("../../util/logger");

/**
 * Redis broadcast provider.
 *
 * @type {*}
 */
exports = module.exports = function(broadcastConfig)
{
    var nrp = null;

    var logger = logFactory("REDIS BROADCAST");

    // leave this in for legacy-support
    var logLevel = 'info';
    if (process.env.CLOUDCMS_BROADCAST_REDIS_DEBUG_LEVEL) {
        logLevel = (process.env.CLOUDCMS_BROADCAST_REDIS_DEBUG_LEVEL + "").toLowerCase()
    }
    logger.setLevel(logLevel, true);

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

        logger.info("using config = " + nrpConfig);
        
        nrp = new NRP(nrpConfig);

        callback();
    };

    r.publish = function(topic, message, callback)
    {
        logger.info("publish wait. topic: " + topic + " message: " + message);
        nrp.emit(topic, message);

        // TODO: how do we measure when redis has completed distributing and firing remote handlers?

        setTimeout(function() {
            callback();
        }, 1500);
    };

    r.publish = function(topic, message, callback)
    {
        logger.info("publish. topic: " + topic + " message: " + message);
        nrp.emit(topic, message);

        callback();
    };

    r.subscribe = function(topic, fn, callback)
    {
        logger.info("subscribe. topic: " + topic);
        nrp.on(topic, fn);

        callback();
    };

    r.unsubscribe = function(topic, fn, callback)
    {
        logger.info("unsubscribe. topic: " + topic);
        nrp.off(topic, fn);

        callback();
    };

    return r;
};