var path = require("path");

var redis = require("redis");

/**
 * Redis distributed cache.
 *
 * @type {*}
 */
exports = module.exports = function(cacheConfig)
{
    var client = null;

    var loggingLevels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };
    var NONE = 'NONE', ERROR = 'ERROR', WARN = 'WARN', INFO = 'INFO', DEBUG = 'DEBUG';
    var debugLevel = INFO;
    
    if (process.env.CLOUDCMS_CACHE_REDIS_DEBUG_LEVEL) {
        debugLevel = (process.env.CLOUDCMS_CACHE_REDIS_DEBUG_LEVEL + "").toUpperCase();
    }
    
    var log = function(message, type) {
        type = type || INFO;
        if (loggingLevels[type] >= loggingLevels[debugLevel]) {
            console.log('[REDIS:' + type + '] ' + message);
        }
    };

    var r = {};

    r.init = function(callback)
    {
        var redisPort = cacheConfig.port;
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_CACHE_REDIS_PORT;
        }

        var redisEndpoint = cacheConfig.endpoint;
        if (typeof(redisEndpoint) === "undefined" || !redisEndpoint)
        {
            redisEndpoint = process.env.CLOUDCMS_CACHE_REDIS_ENDPOINT;
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
                log("write -> reply = " + reply, INFO);
                callback(err, reply);
            });
        }
        else
        {
            client.set([key, JSON.stringify(value), "EX", seconds], function(err, reply) {
                log("write.ex -> reply = " + reply, INFO);
                callback(err, reply);
            });
        }
    };

    r.read = function(key, callback)
    {
        client.get([key], function(err, reply) {

            log("read -> reply = " + reply, INFO);
            
            var result = null;
            try
            {
                result = JSON.parse(reply);
            }
            catch (ex)
            {
                result = null;
                err = ex;
            }

            callback(err, result);
        });
    };

    r.remove = function(key, callback)
    {
        client.del([key], function(err) {
            callback(err);
        });
    };
    
    r.keys = function(prefix, callback)
    {
        log('prefix = ' + prefix, INFO);
        client.keys([prefix + '*'], function(err, reply) {
            log("[keys -> reply = " + reply, INFO);
            callback(err, reply);
        });
    };

    return r;
};