var path = require("path");

var redis = require("redis");
var logFactory = require("../../../util/logger");

/**
 * Redis distributed cache.
 *
 * @type {*}
 */
exports = module.exports = function(cacheConfig)
{
    var client = null;

    var logger = logFactory("REDIS CACHE");

    // allow for global redis default
    if (typeof(process.env.CLOUDCMS_REDIS_DEBUG_LEVEL) !== "undefined") {
        logger.setLevel(("" + process.env.CLOUDCMS_REDIS_DEBUG_LEVEL).toLowerCase(), true);
    }

    // allow for redis broadcast specific
    if (typeof(process.env.CLOUDCMS_CACHE_REDIS_DEBUG_LEVEL) !== "undefined") {
        logger.setLevel(("" + process.env.CLOUDCMS_CACHE_REDIS_DEBUG_LEVEL).toLowerCase(), true);
    }

    var r = {};

    r.init = function(callback)
    {
        var redisPort = cacheConfig.port;
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_CACHE_REDIS_PORT;
        }
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_REDIS_PORT;
        }

        var redisEndpoint = cacheConfig.endpoint;
        if (typeof(redisEndpoint) === "undefined" || !redisEndpoint)
        {
            redisEndpoint = process.env.CLOUDCMS_CACHE_REDIS_ENDPOINT;
        }
        if (typeof(redisEndpoint) === "undefined" || !redisEndpoint)
        {
            redisEndpoint = process.env.CLOUDCMS_REDIS_ENDPOINT;
        }

        var redisOptions = {};

        //redis.debug_mode = true;

        client = redis.createClient(redisPort, redisEndpoint, redisOptions);

        callback();
    };

    r.write = function(key, value, seconds, callback)
    {
        if (seconds <= -1)
        {
            client.set([key, JSON.stringify(value)], function(err, reply) {
                if (err) {
                    logger.error("write error. key: " + key + " value: " + JSON.stringify(value) + ". error:" + err);
                }
                logger.info("write -> reply = " + reply);
                callback(err, reply);
            });
        }
        else
        {
            client.set([key, JSON.stringify(value), "EX", seconds], function(err, reply) {
                if (err) {
                    logger.error("write.ex error. key: " + key + " value: " + JSON.stringify(value) + ". error:" + err);
                }
                logger.info("write.ex -> reply = " + reply);
                callback(err, reply);
            });
        }
    };

    r.read = function(key, callback)
    {
        client.get([key], function(err, reply) {

            if (err) {
                logger.error("read error. key: " + key + ". error:" + err);
            }
            logger.info("read. key: " + key + " -> reply = " + reply);
            
            var result = null;
            try
            {
                result = JSON.parse(reply);
            }
            catch (ex)
            {
                result = null;
                err = ex;
                if (err) {
                    logger.error("error parsing reply. key: " + key + ". error:" + err);
                }
            }

            callback(err, result);
        });
    };

    r.remove = function(key, callback)
    {
        logger.info("remove. key: " + key);
        client.del([key], function(err) {
            callback(err);
        });
    };
    
    r.keys = function(prefix, callback)
    {
        logger.info('keys. prefix = ' + prefix);
        client.keys([prefix + '*'], function(err, reply) {
            if (err) {
                logger.error("error reading prefix: " + prefix + ". error:" + err);
            }
            logger.info("[keys -> reply = " + reply);
            callback(err, reply);
        });
    };

    return r;
};