var path = require('path');
var fs = require('fs');
var util = require("util");
var uuid = require("node-uuid");

var mkdirp = require('mkdirp');

var Gitana = require('gitana');

exports = module.exports;

exports.bindGitana = function(socket, callback)
{
    if (socket.gitana)
    {
        callback();

        return;
    }

    // determine host of socket
    var host = socket.handshake.headers.host;
    if (socket.handshake.headers["x-forwarded-host"])
    {
        host = socket.handshake.headers["x-forwarded-host"];
    }

    var x = host.indexOf(":");
    if (x > -1)
    {
        host = host.substring(0, x);
    }

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
    if (hostGitanaConfig)
    {
        Gitana.connect(hostGitanaConfig, function(err) {
            socket.gitana = this;

            callback(err);
        });
    }
};

