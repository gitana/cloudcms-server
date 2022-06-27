//var path = require("path");

//var redis = require("redis");
var logFactory = require("../../../util/logger");
//const redisHelper = require("../../../util/redis");

var redisClientFactory = require("../../../clients/redis");
const redisHelper = require("../../../util/redis");

/**
 * Redis distributed cache.
 *
 * @type {*}
 */
exports = module.exports = function(cacheConfig)
{
    var client = null;
    
    var logger = redisHelper.redisLogger("REDIS_CACHE", "CLOUDCMS_CACHE_", "error")
    
    var r = {};
    
    r.init = function(callback)
    {
        redisClientFactory.create(cacheConfig, function(err, _client) {
            
            if (err) {
                return callback(err);
            }
            
            client = _client;
            
            return callback();
            
        });
    };
    
    r.write = function(key, value, seconds, callback)
    {
        logger.info('write, key = ' + key + ', value = ' + value + '', seconds = ' + seconds');
        (async function() {
            
            var reply = null;
            var err = null;
            
            try
            {
                if (seconds <= -1)
                {
                    reply = await client.set([key, JSON.stringify(value)]);
                }
                else
                {
                    reply = await client.set([key, JSON.stringify(value), "EX", seconds]);
                }
            }
            catch (e)
            {
                err = e;
            }
            
            if (reply) {
                logger.info("write -> reply = " + reply);
            }
            
            if (err) {
                logger.error("write error. key: " + key + " value: " + JSON.stringify(value) + ". error:" + err);
            }
            
            callback(err, reply);
            
        })();
    };
    
    r.read = function(key, callback)
    {
        logger.info('read, key = ' + key);
        
        (async function() {
            
            var err = null;
            var reply = null;
            
            try
            {
                reply = await client.get([key]);
            }
            catch (e)
            {
                err = e;
            }
            
            if (err) {
                logger.error("read error. key: " + key + ". error:" + err);
            }
            
            if (reply) {
                logger.info("read. key: " + key + " -> reply = " + reply);
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
                
                if (err)
                {
                    logger.error("error parsing reply. key: " + key + ". error:" + err);
                }
            }
            
            callback(err, result);
        })();
    };
    
    r.remove = function(key, callback)
    {
        logger.info('remove, key = ' + key);
        
        (async function() {
            
            var err = null;
            
            try
            {
                await client.del([key]);
                logger.info("remove. key: " + key);
            }
            catch (e)
            {
                err = e;
            }
            
            callback(err);
        })();
    };
    
    r.keys = function(prefix, callback)
    {
        logger.info('keys, prefix = ' + prefix);
        
        (async function() {
            
            var err = null;
            var reply = null;
            
            try
            {
                reply = await client.keys([prefix + '*']);
            }
            catch (e)
            {
                err = e;
            }
            
            if (err) {
                logger.error("error reading prefix: " + prefix + ". error:" + err);
            }
            
            if (reply) {
                logger.info("[keys -> reply = " + reply);
            }
            
            callback(err, reply);
            
        })();
    };
    
    return r;
};