var logFactory = require("../../util/logger");
//var redisHelper = require("../../util/redis");

var redisClientFactory = require("../../clients/redis");
const redisHelper = require("../../util/redis");

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
    
    var client = null;
    
    var logger = redisHelper.redisLogger("REDIS_LOCKS", "CLOUDCMS_LOCKS_", "error")
    
    var r = {};
    
    r.init = function(callback)
    {
        redisClientFactory.create(locksConfig, function(err, _client) {
            
            if (err) {
                return callback(err);
            }
            
            client = _client;
            
            return callback();
        });
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