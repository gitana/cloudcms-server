var util = require("../../util/util");
var logFactory = require("../../util/logger");

/**
 * Awareness middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var logger = logFactory("AWARENESS");
    var provider = null;
    var REAP_FREQUENCY = 3000;  // reaps every 3 seconds
    var LIFE_TIME = 5000;    // 10 seconds -> old enough to reap

    var r = {};
    var init = r.init = function(callback) {
        var type = process.configuration.awareness.type;
        if (!type) {
            type = "memory";    // default type to "memory"
        }

        var config = process.configuration.awareness.config;
        if (!config) {
            config = {};
        }

        provider = require("./providers/" + type);
        logger.info("Provider is required from: ./providers/" + type);

        provider.init(config, function(err){
            if (err) {
                return callback(err);
            }

            socketInit(process.IO);

            reaperInit(process.IO, REAP_FREQUENCY, function(err) {
                callback(err);
            });
        });
    };

    var socketInit = function(io)
    {
        io.on("connection", function(socket) {

            socket.on("room", function(info, callback) {

                var channelId = info.channelId;
                var user = info.user;

                checkNew(channelId, user, function(isNew) {

                    register(channelId, user, function(value) {
                        if (isNew) {
                            socket.join(channelId);
                            io.sockets.in(channelId).emit("updated", channelId);
                        }
                        else {
                            callback("User " + user.id + " already registered in channel " + channelId + " .");
                        }
                    });
                });
            });

            socket.on("discover", function(channelId, callback) {
                discover(channelId, function(userArray) {
                    callback(userArray);
                });
            });

            socket.on("acquireLock", function(info, callback) {
                acquireLock(info, function(res) {
                    callback(res);
                });
            });

            socket.on("releaseLock", function(info, callback) {
                releaseLock(info, function(res) {
                    callback(res);
                });
            });

        });
    };

    /**
     * Initialize a reaper that reaps old registrations every 3 seconds.
     * 
     * @param {*} callback 
     */
    var reaperInit = function(io, frequency, callback) {
        var reap = function() {

            checkOld(LIFE_TIME, function(updatedChannels) {

                if (updatedChannels && updatedChannels.size > 0) {
                    logger.info("\nFound old guys in " + updatedChannels.size + " channels");

                    updatedChannels.forEach(function(channelId) {
                        io.sockets.in(channelId).emit("updated", channelId);

                        updatedChannels.delete(channelId);
                    });
                }
            });

            setTimeout(function() {
                reap();
            }, frequency);
        };

        reap();

        callback();
    };

    var register = r.register = function(channelId, user, callback)
    {
        provider.register(channelId, user, function(value) {
            callback(value);
        });
    };

    var discover = r.discover = function(channelId, callback)
    {        
        provider.discover(channelId, function(userArray) {
            callback(userArray);
        });
    };

    var checkNew = r.checkNew = function(channelId, user, callback)
    {
        provider.checkNew(channelId, user, function(result) {
            callback(result);
        });
    };

    var checkOld = r.checkOld = function(lifeTime, callback)
    {
        provider.checkOld(lifeTime, function(rooms) {
            callback(rooms);
        });
    };

    /**
     * @param info  user, action, object
     * @returns     object-lock information 
     */
    var acquireLock = r.acquireLock = function(info, callback) 
    {
        provider.acquireLock(info, function(res) {
            callback(res);
        });
    };

    /**
     * @param info  an object contains channelId and userId of the lock
     * @returns     boolean. Return false if channel isn't locked
     */
    var releaseLock = r.releaseLock = function(info, callback) 
    {
        provider.releaseLock(info, function(res) {
            callback(res);
        });
    };

    return r;
}();