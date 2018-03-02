var redis = require("redis");
var util = require("../../util/util");
var logFactory = require("../../util/logger");
var async = require("async");

/**
 * Awareness middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var _client = null;
    var getClient = function(){
        if (_client) {
            return _client;
        }

        var redisPort = process.configuration.awareness.redisPort; 
        if (typeof(redisPort) === "undefined" || !redisPort)
        {
            redisPort = process.env.CLOUDCMS_CACHE_REDIS_PORT;
        }

        var redisHost = process.configuration.awareness.redisHost;
        if (typeof(redisHost) === "undefined" || !redisHost)
        {
            redisHost = process.env.CLOUDCMS_CACHE_REDIS_ENDPOINT;
        }

        var redisOptions = {};

        //redis.debug_mode = true;

        _client = redis.createClient(redisPort, redisHost, redisOptions);
        return _client;
    };

    var logger = logFactory("REDIS");

    var r = {};

    /**
     * Provides handlers for awareness operations.
     *
     * @return {Function}
     */
    r.awarenessHandler = function()
    {
        return util.createHandler("awareness", function(req, res, next, stores, cache, configuration) {

            if (req.method.toLowerCase() === "post")
            {
                if (req.path.indexOf("/_awareness/register") === 0)
                {
                    // get info from req.body which is a json.. user, object, action
                    var info = req.body;

                    // 3 objects; each has an id
                    var user = info.user;
                    var object = info.object;
                    var action = info.action;
                    var seconds = info.seconds;

                    return handleRegister(req, res, user, object, action, seconds, function(err) {
                        res.status(200);
                        res.end();
                    });
                }
                if (req.path.indexOf("/_awareness/discover") === 0)
                {
                    var info = req.body;

                    var targetId = info.key;

                    return handleDiscover(req, res, targetId, function(err) {
                        res.status(200);
                        res.end();
                    });
                }
            }

            next();

        });
    };

    /**
     * Handles a register post.
     *
     * @param req
     * @param res
     * @param user
     * @param object
     * @param action
     */
    var handleRegister = function(req, res, user, object, action, seconds, callback)
    {
        var client = getClient();
        var ttl = 10;

        if (!user.id || !object.id || !action.id) {
            var msg = "user, object and action each should have an id."
            logger.error("register error. " + msg);
            return callback(msg);
        }

        // construct a unique key
        var key = user.id + ":" + action.id + ":" + object.id;
        var value = {
            "user": user,
            "object": object,
            "action": action
        };

        if (typeof(seconds) == "undefined" || seconds <= -1)
        {
            seconds = ttl;
        }

        client.set([key, JSON.stringify(value), "EX", seconds], function(err, reply) {
            if (err) {
                logger.error("register error. key: " + key + " value: " + JSON.stringify(value) + ". error:" + err);
                return callback(err);
            }
            logger.info("reply = " + reply);
                
            callback(null, reply);
        });
    };

    /**
     * Handles a discover post.
     *
     * @param req
     * @param res
     * @param user
     * @param object
     * @param action
     */
    var handleDiscover = function(req, res, targetId, callback)
    {
        var client = getClient();
        var pattern = "*" + targetId + "*";

        // get keys with targetId
        client.keys(pattern, function(err, replies) {
            if (err) {
                logger.error("discover error. key: " + key + ". error:" + err);
                return callback(err);
            }

            // solution1. redis get multiple keys... build array of keys and make a single call - callback in the cb
            // solution2. use async lib
            var values = [];
            var fns = [];

            // get values of the matched keys
            replies.forEach(function(key) {
                logger.info("key = " + JSON.stringify(key));

                var fn = function(key, client, values) {
                    return function(done) {
                        client.get(key, function(err, value) {
                            if (err) {
                                logger.error("discover error. Cannot find value for key: " + key);
                            }
                            else {
                                logger.info("value for key " + key + " = " + value);
                                values.push(JSON.stringify(value));
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