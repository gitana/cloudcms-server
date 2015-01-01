var path = require('path');
var fs = require('fs');
var util = require("./util");
var hosts = require("./hosts");
var Gitana = require('gitana');

var stores = require("../middleware/stores/stores");

exports = module.exports;

exports.bindGitana = function(socket, callback)
{
    if (socket.gitana)
    {
        return;
    }

    // determine host of socket
    var host = hosts.determineHostForSocket(socket);
    if (!host)
    {
        callback({
            "message": "Unable to determine host from socket headers"
        });

        return;
    }

    // retain host on the socket instance
    socket.host = host;

    // find the stores for this host
    socket.stores = stores.stores(host);
    socket.rootStore = socket.stores.root;
    socket.webStore = socket.stores.web;
    socket.configStore = socket.stores.config;
    socket.contentStore = socket.stores.content;

    var driverConfig = require("../middleware/driver-config/driver-config");
    var virtualConfig = require("../middleware/virtual-config/virtual-config");
    var cloudcms = require("../middleware/cloudcms/cloudcms");

    driverConfig.resolveConfig(socket, function(err) {

        if (process.configuration.virtualDriver && process.configuration.virtualDriver.enabled)
        {
            virtualConfig.acquireGitanaJson(host, socket.rootStore, socket.log, function(err) {

                cloudcms.doConnect(socket, socket.gitanaConfig, function(err) {

                    if (err)
                    {
                        callback(err);
                        return;
                    }

                    socket.gitana = this;

                    callback();
                });

            });
        }
        else if (socket.gitanaConfig)
        {
            cloudcms.doConnect(socket, socket.gitanaConfig, function(err) {

                if (err)
                {
                    callback(err);
                    return;
                }

                socket.gitana = this;

                callback();
            });

        }
    });
};

