var path = require('path');
var fs = require('fs');
var util = require("./util");
var hosts = require("./hosts");
var Gitana = require('gitana');

var stores = require("../middleware/stores/stores");
var driver = require("../middleware/driver/driver");
var driverConfig = require("../middleware/driver-config/driver-config");
var virtualConfig = require("../middleware/virtual-config/virtual-config");

exports = module.exports;

exports.bindGitana = function(socket, callback)
{
    // NO!  if sockets are reused, then we require socket.gitana to rebind each time
    /*
    if (socket.gitana)
    {
        return;
    }
    */

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
    stores.produce(host, function(err, stores) {

        socket.stores = stores;

        var rootStore = stores.root;

        driverConfig.resolveConfig(socket, rootStore, function(err) {

            if (process.configuration.virtualDriver && process.configuration.virtualDriver.enabled)
            {
                virtualConfig.acquireGitanaJson(host, rootStore, socket.log, function(err) {

                    driver.doConnect(socket, socket.gitanaConfig, function(err) {

                        if (err) {
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
                driver.doConnect(socket, socket.gitanaConfig, function(err) {

                    if (err) {
                        callback(err);
                        return;
                    }

                    socket.gitana = this;

                    callback();
                });
            }

        });
    });
};

