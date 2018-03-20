var redis = require("redis");
var async = require("async");
var logFactory = require("../../../util/logger");

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

    r.register = function(user, object, action, callback) {

        if (!user.id || !object.id || !action.id) {
            var msg = "user, object and action each should have an id."
            return callback(msg);
        }

        // construct a unique key
        var key = user.id + ":" + action.id + ":" + object.id;
        var value = JSON.stringify({
            "user": user,
            "object": object,
            "action": action,
            "time": Date.now()
        });

        client.set(key, value, function(err, reply) {
            if (err) {
                return callback(err);
            }
            callback(null, reply);
        });
    };

    r.discover = function(reqObj, callback)
    {
        if (reqObj.regex) 
        {
            // construct pattern from regexString for redis
            // regexString looks like "[0-9]*\\:actionId\\:objectId"
            var regexString = reqObj.regex;
            var pattern = "*";
            var cleanString = regexString.replace(/\\/g, '');   // remove all backslashes 
            var indexOfFirstColon = cleanString.indexOf(":");   
            pattern += cleanString.substring(indexOfFirstColon);
            
            // get matchedKeys
            client.keys(pattern, function(err, matchedKeys) {
                if (err) {
                    return callback(err);
                }

                var values = [];
                var fns = [];
                // get values of the matched keys
                matchedKeys.forEach(function(key) {

                    var fn = function(key, client, values) {
                        return function(done) {
                            client.get(key, function(err, value) {
                                if (err) {
                                    logger.error("discover error. Cannot find value for key: " + key);
                                }
                                else {
                                    values.push(JSON.parse(value));
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
        }

    };

    r.checkOld = function(now, age, callback) 
    {
        // a set of room ids that are updated
        var rooms = new Set();

        // for each record, check time
        client.keys("*", function(err, allKeys) {
            if (err) {
                return callback(err);
            }

            var fns = [];
            allKeys.forEach(function(key) {

                var fn = function(key, client, rooms) {
                    return function(done) {
                        client.get(key, function(err, value) {
                            if (err) {
                                logger.error("Cannot find value for key: " + key);
                            }
                            else {
                                // if too old (> 30 seconds), remove from storage
                                value = JSON.parse(value);
                                var elapsed = now - value.time;
                                if (elapsed > age) {
                                    var roomId = value.action.id + ":" + value.object.id;
                                    rooms.add(roomId);

                                    client.del(key);
                                }
                            }
                            done();
                        });
                    };
                }(key, client, rooms);

                fns.push(fn);
            });

            async.series(fns, function(err){
                callback(err, rooms);
            });

        });
        
        callback(rooms);
    };

    r.checkNew = function(key, callback) 
    {
        client.keys(key, function(err, allkeys) {
            if (allkeys.length < 1) {
                callback(true);
            }
            else {
                callback(false);
            }
        });

        // NO IDEA WHY THIS DOESN'T WORK?!?!

        // if (client.exists(key) == 1) {
        //     console.log("key exists");

        //     callback(true);
        // }
        // else {
        //     console.log("key doesn't exist");

        //     callback(false);
        // }
    };

    return r;
}();