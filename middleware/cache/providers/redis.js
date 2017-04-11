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

    var debug = false;

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

        debug = cacheConfig.debug;

        if (typeof(debug) === "undefined") {
            debug = false;
        }

        var redisOptions = {};

        client = redis.createClient(redisPort, redisEndpoint, redisOptions);

        callback();
    };

    r.write = function(key, value, seconds, callback)
    {
        if (seconds <= -1)
        {
            client.set([key, JSON.stringify(value)], function(err, reply) {
                if (debug) {
                    console.log("[redis] write -> reply = " + reply);
                }
                callback(err, reply);
            });
        }
        else
        {
            client.set([key, JSON.stringify(value), "EX", seconds], function(err, reply) {
                if (debug) {
                    console.log("[redis] write.ex -> reply = " + reply);
                }
                callback(err, reply);
            });
        }
    };

    r.read = function(key, callback)
    {
        client.get([key], function(err, reply) {

            if (debug) {
                console.log("[redis] read -> reply = " + reply);
            }
            
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
        if (debug) {
            console.log('[redis] prefix = ' + prefix);
        }
        client.keys([prefix + '*'], function(err, reply) {
            if (debug) {
                console.log("[redis] keys -> reply = " + reply);
            }
            callback(err, reply);
        });
    };

    return r;
};
