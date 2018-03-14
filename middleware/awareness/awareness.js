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

            socket.on("register", function(data, callback) {
                var user = data.user;
                var object = data.object;
                var action = data.action;
                var seconds = data.seconds;
        
                register(user, object, action, seconds, function(err, value) {
                    callback(value);
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

    return r;
}();