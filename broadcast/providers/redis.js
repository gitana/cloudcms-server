var redisClientFactory = require("../../clients/redis");
var redisHelper = require("../../util/redis");

var NRP = require("../../clients/nrp");

/**
 * Redis broadcast provider.
 *
 * @type {*}
 */
exports = module.exports = function(broadcastConfig)
{
    var nrp = null;
    
    var logger = redisHelper.redisLogger("REDIS_BROADCAST", "CLOUDCMS_BROADCAST_", "error")
    
    var r = {};
    
    r.start = function(callback)
    {
        redisClientFactory.create(broadcastConfig, function(err, client) {
            
            if (err) {
                return callback(err);
            }
            
            var nrpConfig = {
                "client": client,
                "scope": "broadcast_cache"
            };
            
            logger.info("using config = " + nrpConfig);
            
            nrp = new NRP(nrpConfig);
            nrp.connect(function(err) {
                callback(err);
            });
        });
    };
    
    r.publish = function(topic, message, callback)
    {
        logger.info("publish. topic: " + topic + " message: " + message);
        nrp.emit(topic, message);
        
        callback();
    };
    
    r.subscribe = function(topic, fn, callback)
    {
        logger.info("subscribe. topic: " + topic);
        nrp.on(topic, fn);
        
        callback();
    };
    
    r.unsubscribe = function(topic, fn, callback)
    {
        logger.info("unsubscribe. topic: " + topic);
        nrp.off(topic, fn);
        
        callback();
    };
    
    return r;
};