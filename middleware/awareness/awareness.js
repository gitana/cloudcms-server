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
    var AGE = 30000;    // 30 seconds -> old enough to reap

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
                var room = info.roomId;
                var data = info.clientInfo;

                var user = data.user;
                var object = data.object;
                var action = data.action;

                // check if you are new
                var key = user.id + ":" + action.id + ":" + object.id;

                checkNew(key, function(isNew) {

                    if (isNew) {

                        // let you in
                        socket.join(room);

                        // register you
                        register(user, object, action, function(err, value) {
                            callback("You (socket id: " + socket.id + ") joined room " + room + " and registered.");
                        });

                        // tell everyone in room about new guy
                        io.sockets.in(room).emit("updated", data);
                    }
                    else {
                        callback("key: " + key + " already registered.");
                    }
                });
            });

            socket.on("discover", function(data, callback) {
                var reqObj = {
                    "regex": data
                };
    
                discover(reqObj, function(err, value) {
                    callback(value);
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

            // ask provider for old guys and remove from storage, return rooms that are updated
            checkOld(Date.now(), AGE, function(rooms) {

                if (rooms && rooms.size > 0) {
                    logger.info("\nFound old guys in " + rooms.size + " rooms");

                    rooms.forEach(function(roomId) {

                        var roomData = {
                            "action": {
                                "id": roomId.split(":")[0]
                            },
                            "object": {
                                "id": roomId.split(":")[1]                            
                            }
                        };

                        // then tell everyone in room to discover the updated storage with old guys removed
                        io.sockets.in(roomId).emit("updated", roomData);

                        rooms.delete(roomId);
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

    var register = r.register = function(user, object, action, callback)
    {
        provider.register(user, object, action, function(err, value) {
            callback(err, value);
        });
    };

    var discover = r.discover = function(reqObj, callback)
    {        
        provider.discover(reqObj, function(err, value) {
            callback(err, value);
        });
    };

    var checkNew = r.checkNew = function(key, callback)
    {
        provider.checkNew(key, function(result) {
            callback(result);
        });
    };

    var checkOld = r.checkOld = function(now, age, callback)
    {
        provider.checkOld(now, age, function(rooms) {
            callback(rooms);
        });
    };

    return r;
}();