var memored = require('../../../temp/memored');
var logFactory = require("../../../util/logger");
var async = require("async");

/**
 * Shared cluster awareness using memored
 * WARNING: NOT READY FOR PRODUCTION!
 *
 * @type {*}
 */
exports = module.exports = function()
{
    var logger = logFactory("SHARED-MEMORY");
    var r = {};

    r.init = function(config, callback)
    {
        callback();
    };

    r.register = function(user, object, action, seconds, callback) 
    {        
        var TTL = 10;
        if (typeof(seconds) == "undefined" || seconds <= -1)
        {
            seconds = TTL;
        }

        if (!user.id || !object.id || !action.id) {
            var msg = "user, object and action each should have an id."
            return callback(msg);
        }

        var key = user.id + ":" + action.id + ":" + object.id;
        var value = JSON.stringify({
            "user": user,
            "object": object,
            "action": action
        });

        // this part is broken
        memored.store(key, value, seconds * 1000, function(err) {
            console.log("stored...");

            if (err) {
                logger.info("info: " + "key is " + key + ". value is " + value);
                logger.err("err: " + err.toString());
            }
            logger.info("memored storing: info: " + "key is " + key + ". value is " + value);
            callback();
        });
    };

    r.discover = function(targetId, callback)
    {
        var matchedKeys = [];
        var values = [];

        // find keys that contain substring targetId
        var getKeys = function(matchedKeys, targetId) {
            return function(done) {
                memored.keys(function(err, keys) {
                    if (err) {
                        callback(err);
                        return;
                    }
        
                    for (var i = 0; i < keys.length; i++)
                    {
                        if (keys[i].indexOf(targetId) > -1)
                        {
                            matchedKeys.push(keys[i]);
                        }
                    }

                    done();
                });
            };
        }(matchedKeys, targetId);

        // read value for all matched keys
        var getValues = function(matchedKeys, values) {
            return function(done) {
                matchedKeys.forEach(function(key) {
                    memored.read(key, function(err, value) {
                        values.push(value);
                    });    
                });
                done();
            };
        }(matchedKeys, values);

        var fns = [getKeys, getValues];
        async.series(fns, function(err) {
            callback(err, values);
        });
    };

    return r;
}();