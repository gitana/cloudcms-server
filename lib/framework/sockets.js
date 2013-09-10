var http = require("http");
var path = require("path");

var Gitana = require("gitana");

var exports = module.exports;

exports.init = function(socket)
{
    console.log("Socket init");

    // on first connect, announce the server timestamp
    socket.emit("timestamp", {
        "timestamp": process.env.CLOUDCMS_APPSERVER_TIMESTAMP
    });

    // determine host of socket
    var host = socket.handshake.headers.host;
    console.log("Socket handshake host: " + host);
    var x = host.indexOf(":");
    if (x > -1)
    {
        host = host.substring(0, x);
    }

    console.log("Socket host: " + host);

    // attach "cache" helper to the socket
    var hostCacheConfig = process.cache.read("hostCacheConfigs", host);
    if (hostCacheConfig)
    {
        var applicationId = hostCacheConfig.applicationId;
        var principalId = hostCacheConfig.principalId;

        socket.cache = process.cache.cacheBuilder(applicationId, principalId);
    }

    // attach "gitana" instance to the socket
    var hostGitanaConfig = process.cache.read("hostGitanaConfigs", host);
    console.log("Socket host config: " + JSON.stringify(hostGitanaConfig));
    if (hostGitanaConfig)
    {
        Gitana.connect(hostGitanaConfig, function(err) {
            console.log("Socket host bind, err: " + err);
            console.log("Socket host bind, gitana: " + this);
            socket.gitana = this;
        });
    }
};

exports.library = function(socket, library)
{
    var addHandler = function(methodName)
    {
        socket.on(methodName + "Request", function(data) {

            var responseMethodName = methodName + "Response";
            if (data.responseMethodName) {
                responseMethodName = data.responseMethodName;
            }

            var method = library[methodName];
            if (method)
            {
                method(responseMethodName, socket, data);
            }
        });
    };

    // all methods from the "sockets" library implement command handlers
    for (var methodName in library)
    {
        if (library.hasOwnProperty(methodName) && typeof(library[methodName]) === "function")
        {
            addHandler(methodName);
        }
    }
};
