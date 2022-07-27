const redisHelper = require("../../util/redis");

const IORedis = require("ioredis");
var Redlock = require("redlock");

/**
 * Redis lock service.
 *
 * @type {*}
 */
exports = module.exports = function(locksConfig)
{
    var redlock = null;
    var client = null;
    
    var logger = redisHelper.redisLogger("REDIS_LOCKS", "CLOUDCMS_LOCKS_", "error")
    
    var r = {};

    r.init = function(callback)
    {
        var redisOptions = redisHelper.redisOptions(locksConfig);
        client = new IORedis(redisOptions.url);
        
        redlock = new Redlock(
            [client],
            {
                // the expected clock drift; for more details
                // see http://redis.io/topics/distlock
                driftFactor: 0.01, // multiplied by lock ttl to determine drift time
        
                // the max number of times Redlock will attempt
                // to lock a resource before erroring
                retryCount:  10,
        
                // the time in ms between attempts
                retryDelay:  200, // time in ms
        
                // the max time in ms randomly added to retries
                // to improve performance under high contention
                // see https://www.awsarchitectureblog.com/2015/03/backoff.html
                retryJitter:  200 // time in ms
            }
        );

        return callback();
    };

    r.lock = function(key, fn)
    {
        key = key.trim();
        key = key.toLowerCase();
        key = key.replace(/[\W_]+/g,"");
        
        var lockKey = "cloudcms:locks:write:" + key;
    
        logger.debug("lock.acquire:", lockKey);
        
        redlock.lock(lockKey, 2000, function(err, lock) {
            
            if (err) {
                logger.error("Failed to acquire redis lock:", lockKey, err);
                return fn(err);
            }
    
            logger.debug("lock.acquired:", lockKey);

            var releaseCallbackFn = function(lock, lockKey) {
                return function() {
    
                    logger.debug("lock.release:", lockKey);
                    
                    lock.unlock(function(err) {
                        if (err) {
                            logger.error("Failed to release redis lock:", lockKey, err);
                        }
                    });
                }
            }(lock, lockKey);
    
            logger.debug("lock.invokeFn");
            fn(null, releaseCallbackFn);
            
        });
    };

    return r;
};