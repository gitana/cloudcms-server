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

    r.register = function(channelId, user, callback) 
    {
        var key = "vm" + channelId + "/" + user.id;

        var value = {
            "user": user,
            "time": Date.now()
        };

        client.set(key, JSON.stringify(value), function(err, reply) {
            if (err) {
                return callback(err);
            }

            callback(reply);
        });
        
    };

    r.discover = function(channelId, callback) 
    {
        var pattern = "vm" + channelId + "*";
        
        client.keys(pattern, function(err, mKeys) {
            if (err) {
                return callback(err);
            }

            var fns = [];
            var array = [];

            mKeys.forEach(function(key) {

                var fn = function(key, client, array) {
                    return function(done) {
                        client.get(key, function(err, reply) {
                            if (err) {
                                return callback(err);
                            }
        
                            array.push(JSON.parse(reply));

                            done();
                        });
                    }
                } (key, client, array);

                fns.push(fn);

            });

            async.series(fns, function(err){
                if (err) {
                    return callback(err);
                }
    
                callback(array);
            });
        });

    };

    r.checkOld = function(lifeTime, callback) 
    {
        var channels = new Set();

        // for each valueMap (vm) record, check time
        client.keys("vm*", function(err, vmKeys) {
            if (err) {
                return callback(err);
            }

            var fns = [];
            vmKeys.forEach(function(key) {

                var fn = function(key, client, channels) {
                    return function(done) {
                        client.get(key, function(err, value) {
                            if (err) {
                                return callback(err);
                            }
                                            
                            value = JSON.parse(value);

                            var elapsed = Date.now() - value.time;
                            if (elapsed > lifeTime) {

                                // extract channelId from key
                                var channelId = key.split("/")[0].substring(2);
                                channels.add(channelId);

                                client.del(key);
                            }
                            
                            done();
                        });
                    };
                }(key, client, channels);

                fns.push(fn);
            });

            async.series(fns, function(err){
                callback(channels);
            });

        });
        
        callback(channels);
    };

    r.checkNew = function(channelId, user, callback) 
    {
        var key = "vm" + channelId + "/" + user.id;

        client.keys(key, function(err, reply) {
            if (reply.length < 1) {
                callback(true);
            }
            else {
                callback(false);
            }
        });
    };

    r.acquireLock = function(info, callback)
    {
        var channelId = info.action.id + ":" + info.object.id;
        var key = "lm" + channelId;

        client.get(key, function(err, reply) {
            if (err) {
                return callback(err);
            }

            var value = null;
            if (!reply) {
                value = {
                    "lockTime": Date.now(),
                    "user": info.user
                };

                client.set(key, JSON.stringify(value));
            }
            else {
                value = JSON.parse(reply);
            }

            var res = {
                "acquireInfo": value,
            };
    
            callback(res);
        });

    };

    r.releaseLock = function(info, callback)
    {
        var channelId = info.channelId;
        var userId = info.userId;
        
        var releaseInfo = {};

        var key = "lm" + channelId;
        client.get(key, function(err, reply) {
            if (err) {
                return callback(err);
            }

            if (reply) {
                var value = JSON.parse(reply);
                if (value && value.user.id == userId)
                {
                    client.del(key);
                    releaseInfo.released = true;
                }
                else {
                    releaseInfo.released = false;
                    releaseInfo.lockStatus = value? "locked" : "unlocked";
                }
            }

            var res = {
                "releaseInfo": releaseInfo
            };
            
            callback(res);
    
        });
    };

    return r;
}();