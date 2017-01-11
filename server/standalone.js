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

/**
 * Only the first server gets this callback and is allowed to make a report of the infrastructure status.
 */
server.report(function(callback) {

    var cpuCount = require('os').cpus().length;

    var port = process.env.PORT;

    // provide some debug info
    console.log("Node Version: " + process.version);
    console.log("Server Mode: " + process.env.CLOUDCMS_APPSERVER_MODE);
    console.log("Server Base Path: " + process.env.CLOUDCMS_APPSERVER_BASE_PATH);
    console.log("Gitana Scheme: " + process.env.GITANA_PROXY_SCHEME);
    console.log("Gitana Host: " + process.env.GITANA_PROXY_HOST);
    console.log("Gitana Port: " + process.env.GITANA_PROXY_PORT);
    console.log("CPU Count: " + cpuCount);

    var virtualHost = null;
    if (process.env.CLOUDCMS_VIRTUAL_HOST) {
        virtualHost = process.env.CLOUDCMS_VIRTUAL_HOST;
    }
    if (!virtualHost && process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN) {
        virtualHost = "*." + process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN;
    }
    if (virtualHost)
    {
        console.log("Virtual Host: " + virtualHost);
    }

    console.log("Store Configuration: " + process.env.CLOUDCMS_STORE_CONFIGURATION);
    console.log("Broadcast Provider: " + process.env.CLOUDCMS_BROADCAST_TYPE);
    console.log("Cache Provider: " + process.env.CLOUDCMS_CACHE_TYPE);
    console.log("Temp Directory: " + process.env.CLOUDCMS_TEMPDIR_PATH);
    console.log("LaunchPad Mode: " + process.env.CLOUDCMS_LAUNCHPAD_SETUP);
    console.log("Max Files Detected: " + process.env.CLOUDCMS_MAX_FILES);

    console.log("");

    console.log("To view your app, go to http://localhost:" + port + "/");
    console.log("");

    callback();
});

// start the server
server.start({
    "setup": "single",
    "virtualHost": {
        "enabled": true
    },
    "wcm": {
        "enabled": true//,
        //"cache": false
    },
    "serverTags": {
        "enabled": true
    },
    "autoRefresh": {
        "log": true
    },
    "insight": {
        "enabled": true
    },
    "duster": {
        "fragments": {
            "cache": true
        }
    }
}, function() {
    // all done
});
