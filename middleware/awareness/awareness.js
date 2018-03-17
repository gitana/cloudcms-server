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
            socketInit(process.IO)
            callback(err);
        });
    };

    var register = r.register = function(user, object, action, seconds, callback)
    {
        provider.register(user, object, action, seconds, function(err, value) {
            callback(err, value);
        });
    };

    var discover = r.discover = function(reqObj, callback)
    {        
        provider.discover(reqObj, function(err, value) {
            callback(err, value);
        });
    };

    var socketInit = function(io)
    {
        io.on("connection", function(socket) {

            socket.on("room", function(info, callback) {
                var room = info.roomId;
                var data = info.clientInfo;

                // let you in
                socket.join(room);

                // tell everyone in room about you
                io.sockets.in(room).emit("newguy", data);

                // register you
                var user = data.user;
                var object = data.object;
                var action = data.action;
                var seconds = data.seconds;
                register(user, object, action, seconds, function(err, value) {
                    callback("You (socket id: " + socket.id + ") joined room " + room + " and registered.");
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

            /*************** TESTING ***************/
            socket.on('disconnect', function() {
                console.log('socket ' + socket.id + ' Got disconnect!');
            });

        });
    };

    return r;
}();