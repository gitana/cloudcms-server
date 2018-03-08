var redis = require("redis");
var logFactory = require("../../../util/logger");
var async = require("async");

/**
 * In-Redis awareness.
 *
 * @type {*}
 */
exports = module.exports = function()
{
    var client = null;
    var logger = logFactory("REDIS");

    var r = {};

    r.init = function(config, callback)
    {
        var redisPort = config.port;
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_CACHE_REDIS_PORT;
        }

        var redisHost = config.host;
        if (typeof(redisHost) === "undefined" || !redisHost)
        {
            redisHost = process.env.CLOUDCMS_CACHE_REDIS_ENDPOINT;
        }

        var redisOptions = {};

        //redis.debug_mode = true;

        client = redis.createClient(redisPort, redisHost, redisOptions);

        callback();
    };

    r.register = function(user, object, action, seconds, callback) {
        var ttl = 10;

        if (!user.id || !object.id || !action.id) {
            var msg = "user, object and action each should have an id."
            logger.error("register error. " + msg);
            return callback(msg);
        }

        // construct a unique key
        var key = user.id + ":" + action.id + ":" + object.id;
        var value = JSON.stringify({
            "user": user,
            "object": object,
            "action": action
        });

        if (typeof(seconds) == "undefined" || seconds <= -1)
        {
            seconds = ttl;
        }

        client.set([key, value, "EX", seconds], function(err, reply) {
            if (err) {
                logger.error("register error. key: " + key + " value: " + value + ". error:" + err);
                return callback(err);
            }
            logger.info("reply = " + reply + ". value = " + value);
                
            callback(null, reply);
        });
    };

    r.discover = function(regexString, callback)
    {
        // construct pattern from regexString for redis
        // regexString looks like "[0-9]*\\:actionId\\:objectId"
        var pattern = "*";
        var cleanString = regexString.replace(/\\/g, '');   // remove all backslashes 
        var indexOfFirstColon = cleanString.indexOf(":");   
        pattern += cleanString.substring(indexOfFirstColon);
        
        // get matchedKeys
        client.keys(pattern, function(err, matchedKeys) {
            if (err) {
                logger.error("discover error. key: " + key + ". error:" + err);
                return callback(err);
            }

            // solution1. redis get multiple keys... build array of keys and make a single call - callback in the cb
            // solution2. use async lib
            var values = [];
            var fns = [];

            // get values of the matched keys
            matchedKeys.forEach(function(key) {
                logger.info("key = " + key);

                var fn = function(key, client, values) {
                    return function(done) {
                        client.get(key, function(err, value) {
                            if (err) {
                                logger.error("discover error. Cannot find value for key: " + key);
                            }
                            else {
                                values.push(JSON.parse(value));
                                logger.info("value for key " + key + " = " + value);
                            }
                            done();
                        });
                    };
                }(key, client, values);
                fns.push(fn);
            });

            async.series(fns, function(err){
                callback(err, values);
            });

        });
    };

    return r;
}();