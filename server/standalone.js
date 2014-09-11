var server = require("./index");

var frameworkControllers = require("../framework/controllers");
var frameworkSockets = require("../framework/sockets");

var exports = module.exports;

/**
 * Default route handlers
 */
server.routes(function(app, callback) {
    frameworkControllers.init(app, function() {
        callback();
    });
});

/**
 * Default socket handlers
 */
server.sockets(function(socket, callback) {
    frameworkSockets.init(socket, function() {
        callback();
    });
});

/**
 * Things we want to run after server start.
 */
server.after(function(app, callback) {
    callback();
});

// start the server
server.start({
    "socketTransports": ["polling"],
    "virtualHost": {
        "enabled": true
    },
    "wcm": {
        "enabled": true
    },
    "serverTags": {
        "enabled": true
    },
    "autoRefresh": {
        "log": true
    },
    "insight": {
        "enabled": true
    }
});
