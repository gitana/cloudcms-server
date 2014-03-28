var path = require('path');
var fs = require('fs');
var util = require("./util");
var uuid = require("node-uuid");
var hosts = require("./hosts");
var Gitana = require('gitana');

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

    // store host
    socket.host = host;

    if (fs.existsSync(process.env.CLOUDCMS_GITANA_JSON_PATH))
    {
        var dataStr = fs.readFileSync(process.env.CLOUDCMS_GITANA_JSON_PATH);
        if (dataStr)
        {
            try
            {
                var json = JSON.parse(dataStr.toString());
                socket.gitanaJsonPath = process.env.CLOUDCMS_GITANA_JSON_PATH;
                socket.gitanaConfig = json;
            }
            catch (e)
            {
            }
        }
    }

    if (process.configuration.virtualDriver && process.configuration.virtualDriver.enabled)
    {
        var virtual = require("../middleware/virtual/virtual")(process.env.CLOUDCMS_HOSTS_PATH);
        virtual.acquireGitanaJson(socket.host, socket._log, function(err, gitanaJsonPath, gitanaJson) {

            socket.virtualHost = host;
            socket.virtualHostGitanaJsonPath = gitanaJsonPath;
            socket.virtualHostGitanaConfig = gitanaJson;
            socket.gitanaJsonPath = gitanaJsonPath;
            socket.gitanaConfig = gitanaJson;

            var cloudcms = require("../middleware/cloudcms/cloudcms")(process.env.CLOUDCMS_HOSTS_PATH);

            cloudcms.connect(gitanaJson, function(err) {

                if (err)
                {
                    console.log("socket.connect.err = " + JSON.stringify(err));
                    callback(err);
                    return;
                }

                socket.gitana = this;

                callback();
            });
        });
    }
    else
    {
        var cloudcms = require("../middleware/cloudcms/cloudcms")(process.env.CLOUDCMS_HOSTS_PATH);

        cloudcms.doConnect(socket, socket.gitanaConfig, function(err) {

            if (err)
            {
                console.log("socket.connect2.err = " + JSON.stringify(err));
                callback(err);
                return;
            }

            socket.gitana = this;

            callback();
        });
    }
};

