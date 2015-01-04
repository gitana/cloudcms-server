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
            client.set([key, value], function(err, reply) {
                console.log("[redis] write -> reply = " + reply);
                callback(err, reply);
            });
        }
        else
        {
            client.set([key, value, "EX", seconds], function(err, reply) {
                console.log("[redis] write.ex -> reply = " + reply);
                callback(err, reply);
            });
        }
    };

    r.read = function(key, callback)
    {
        client.get([key], function(err, reply) {
            console.log("[redis] read -> reply = " + reply);
            callback(err, reply);
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
        client.keys([prefix], function(err, reply) {
            console.log("[redis] keys -> reply = " + reply);
            callback(err, reply);
        });
    };

    return r;
};