var server = require("./index");

/**
 * Things we want to run after server start.
 */
server.after(function(app, callback) {
    callback();
});

// start the server
server.start();

