var path = require("path");
var redis = require("redis");
var logFactory = require("../../util/logger");

/**
 * Redis lock service.
 *
 * @type {*}
 */
exports = module.exports = function(locksConfig)
{
    var redisLock = require("redislock");
    redisLock.setDefaults({
        timeout: 200000,
        retries: 2000,
        delay: 50
    });

    var nrp = null;
    var client = null;

    var logger = logFactory("REDIS LOCK");

    // allow for global redis default
    // allow for redis broadcast specific
    // otherwise default to error
    if (typeof(process.env.CLOUDCMS_REDIS_DEBUG_LEVEL) !== "undefined") {
        logger.setLevel(("" + process.env.CLOUDCMS_REDIS_DEBUG_LEVEL).toLowerCase(), true);
    }
    else if (typeof(process.env.CLOUDCMS_LOCKS_REDIS_DEBUG_LEVEL) !== "undefined") {
        logger.setLevel(("" + process.env.CLOUDCMS_LOCKS_REDIS_DEBUG_LEVEL).toLowerCase(), true);
    }
    else {
        logger.setLevel("error");
    }

    var r = {};

    r.init = function(callback)
    {
        var redisPort = locksConfig.port;
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_LOCKS_REDIS_PORT;
        }
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_REDIS_PORT;
        }

        var redisEndpoint = locksConfig.endpoint;
        if (typeof(redisEndpoint) === "undefined" || !redisEndpoint)
        {
            redisEndpoint = process.env.CLOUDCMS_LOCKS_REDIS_ENDPOINT;
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

    r.lock = function(key, fn)
    {
        var lockKey = "cloudcms:locks:write:" + key;

        var lock = redisLock.createLock(client);

        var releaseCallbackFn = function(lock, lockKey) {
            return function() {
                logger.info("lock.release - " + lockKey);
                lock.release(function(err) {

                    if (err) {
                        console.log("Failed to release redis lock: " + lockKey);
                        console.log("Error: " + err);
                        return;
                    }

                    logger.info("lock.released - " + lockKey);
                });
            }
        }(lock, lockKey);

        logger.info("lock.acquire - " + lockKey);
        lock.acquire(lockKey, function(err) {

            if (err) {
                console.log("Failed to acquire redis lock: " + lockKey);
                console.log("Error: " + err);
                return;
            }

            logger.info("lock.acquired - " + lockKey);

            fn(releaseCallbackFn);
        });
    };

    return r;
};