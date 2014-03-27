var server = require("./index");

var frameworkControllers = require("../framework/controllers");
var frameworkSockets = require("../framework/sockets");

var exports = module.exports;

/**
 * Default route handlers
 */
server.routes(function(app) {
    frameworkControllers.init(app);
});

/**
 * Default socket handlers
 */
server.sockets(function(socket) {
    frameworkSockets.init(socket);
});

/**
 * Things we want to run after server start.
 */
server.after(function(app, callback) {
    callback();
});

// start the server
server.start();