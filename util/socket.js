var path = require('path');
var fs = require('fs');
var util = require("./util");
var hosts = require("./hosts");
var Gitana = require('gitana');

var stores = require("../middleware/stores/stores");
var driver = require("../middleware/driver/driver");
var driverConfig = require("../middleware/driver-config/driver-config");

exports = module.exports;

exports.bindGitana = function(socket, callback)
{
    // determine host of socket
    var host = hosts.determineHostForSocket(socket);
    if (!host)
    {
        return callback({
            "message": "Unable to determine host from socket headers"
        });
    }

    // retain host on the socket instance
    socket.host = host;
    socket.domainHost = host;
    socket.virtualHost = host;

    // find the stores for this host
    stores.produce(host, function(err, stores) {

        socket.stores = stores;

        var rootStore = stores.root;

        driverConfig.resolveConfig(socket, rootStore, function(err) {

            if (err) {
                return callback(err);
            }

            if (!socket.gitanaConfig)
            {
                return callback({
                    "message": "Socket is missing gitanaConfig"
                });
            }

            driver.doConnect(socket, socket.gitanaConfig, function(err) {

                if (err) {
                    return callback(err);
                }

                socket.gitana = this;

                callback();
            });

        });
    });
};

