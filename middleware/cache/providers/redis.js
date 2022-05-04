var path = require("path");

var redis = require("redis");
var logFactory = require("../../../util/logger");
const redisHelper = require("../../../util/redis");

/**
 * Redis distributed cache.
 *
 * @type {*}
 */
exports = module.exports = function(cacheConfig)
{
    var client = null;

    var logger = this.logger = logFactory("REDIS CACHE");
    logger.setLevel("error");

    // allow for global redis default
    // allow for redis broadcast specific
    // otherwise default to error
    if (typeof(process.env.CLOUDCMS_REDIS_DEBUG_LEVEL) !== "undefined") {
        logger.setLevel(("" + process.env.CLOUDCMS_REDIS_DEBUG_LEVEL).toLowerCase(), true);
    }
    else if (typeof(process.env.CLOUDCMS_CACHE_REDIS_DEBUG_LEVEL) !== "undefined") {
        logger.setLevel(("" + process.env.CLOUDCMS_CACHE_REDIS_DEBUG_LEVEL).toLowerCase(), true);
    }

    var r = {};

    r.init = function(callback)
    {
        var self = this;
    
        var redisOptions = redisHelper.redisOptions(cacheConfig, "CLOUDCMS_CACHE");

        client = redis.createClient(redisOptions);
        
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