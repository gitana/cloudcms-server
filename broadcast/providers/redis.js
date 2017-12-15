var path = require("path");

var NRP = require('node-redis-pubsub');
var Logger = require('basic-logger');

/**
 * Redis broadcast provider.
 *
 * @type {*}
 */
exports = module.exports = function(broadcastConfig)
{
    var nrp = null;

    var log = new Logger({
        showMillis: false,
        showTimestamp: true,
        prefix: "REDIS BROADCAST"
    });
    
    var debugLevel = 'info';
    if (process.env.CLOUDCMS_BROADCAST_REDIS_DEBUG_LEVEL) {
        debugLevel = (process.env.CLOUDCMS_BROADCAST_REDIS_DEBUG_LEVEL + "").toLowerCase()
    }
    Logger.setLevel(debugLevel, true);

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

        log.info("using config = " + nrpConfig);
        
        nrp = new NRP(nrpConfig);

        callback();
    };

    r.publish = function(topic, message, callback)
    {
        log.info("publish wait. topic: " + topic + " message: " + message);        
        nrp.emit(topic, message);

        // TODO: how do we measure when redis has completed distributing and firing remote handlers?

        setTimeout(function() {
            callback();
        }, 1500);
    };

    r.publish = function(topic, message, callback)
    {
        log.info("publish. topic: " + topic + " message: " + message);        
        nrp.emit(topic, message);

        callback();
    };

    r.subscribe = function(topic, fn, callback)
    {
        log.info("subscribe. topic: " + topic);        
        nrp.on(topic, fn);

        callback();
    };

    r.unsubscribe = function(topic, fn, callback)
    {
        log.info("unsubscribe. topic: " + topic);        
        nrp.off(topic, fn);

        callback();
    };

    return r;
};