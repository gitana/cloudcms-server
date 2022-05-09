var redis = require("redis");
var redisHelper = require("../util/redis");

var clients = {};

/**
 * Redis client factory.
 *
 * @type {*}
 */
exports = module.exports = {};

var create = exports.create = function(config, callback)
{
    if (typeof(config) === "function") {
        callback = config;
        config = {};
    }
    
    if (!config) {
        config = {};
    }
    
    var redisOptions = redisHelper.redisOptions(config);
    var url = redisOptions.url;
    
    // cached client?
    var client = clients[url];
    if (client) {
        return callback(null, client);
    }
    
    // connect
    (async function() {
        await redisHelper.createAndConnect(redisOptions, function(err, client) {
            
            if (err) {
                return callback(err);
            }
            
            // cache it
            clients[url] = client;
            
            // return
            return callback(null, client);
        });
    })();
};