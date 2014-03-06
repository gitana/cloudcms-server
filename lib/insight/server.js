var http = require("http");
var path = require("path");

var request = require("request");

var util = require("../util/util");

//var SocketUtil = require("../util/socket");

var exports = module.exports;

exports.init = function(socket)
{
    // listen for pushes from the client
    socket.on("insight-push", function(data) {

        //console.log("Received insight push: " + JSON.stringify(data, null, "  "));

        if (data && data.rows)
        {
            socket._log("Event: insight-push, interactions: " + data.rows.length);
            handleInsightPush(socket, data);
        }
    });
};

/**
 * Data comes in:
 *
 * @param data
 */
var handleInsightPush = function(socket, data)
{
    var gitana = socket.gitana;
    if (!gitana)
    {
        console.log("Socket does not have a gitana instance bound to it!");
        return;
    }

    var warehouseId = data.warehouseId;
    if (!warehouseId)
    {
        var analytics = gitana.datastore("analytics");
        if (analytics) {
            warehouseId = analytics.getId();
        }
    }
    if (!warehouseId) {
        console.log("Could not determine warehouse id");
        return;
    }

    var ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address;
    var host = socket.handshake.headers['x-forwarded-host'] || socket.handshake.headers.host;

    // tag all rows with the "applicationKey"
    for (var i = 0; i < data.rows.length; i++)
    {
        data.rows[i].appKey = gitana.application().getId();

        if (!data.rows[i].source) {
            data.rows[i].source = {};
        }

        data.rows[i].source.ip = ip;
        data.rows[i].source.host = host;
    }

    var URL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT + "/warehouses/" + warehouseId + "/interactions/_create";
    var requestConfig = {
        "url": URL,
        "qs": {},
        "method": "POST",
        "json": data
    };

    util.retryGitanaRequest(socket, gitana, requestConfig, 2, function(err, response, body) {

        if (response && response.statusCode == 200 && body)
        {
            // success
        }
        else
        {
            if (err)
            {
                // an HTTP error
                socket._log("Response error: " + JSON.stringify(err));

                // TODO: what do we do here?

                return;
            }

            if (body.error)
            {
                // some kind of operational error
                socket._log("Operational error");
                socket._log(JSON.stringify(body));

                return;
            }
        }
    });
};

