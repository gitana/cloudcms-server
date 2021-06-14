var http = require("http");
var path = require("path");
var request = require("request");
var util = require("../util/util");

/**
 * Insight subsystem.
 *
 * When insight "push" requests come along, we handle them here and pass back to Cloud CMS.
 */
var exports = module.exports;

exports.init = function(socket, callback)
{
    // listen for pushes from the client
    socket.on("insight-push", function(data) {

        console.log("Heard request for insight-push: " + data.rows.length);

        if (process.configuration && process.configuration.insight && process.configuration.insight.enabled)
        {
            if (data && data.rows)
            {
                socket._log("Scheduling insight data rows: " + data.rows.length);

                scheduleData(socket, data);
            }
        }
    });

    callback();
};

// pending data arrays keyed by warehouseId
var PENDING_DATA = {};

/**
 * Data comes in and we schedule it for send to the Cloud CMS server.
 *
 * @param data
 */
var scheduleData = function(socket, data)
{
    var host = socket.handshake.headers['x-forwarded-host'] || socket.handshake.headers.host;

    var gitana = socket.gitana;
    if (!gitana)
    {
        return socket._log("Insight - the socket does not have a gitana instance attached to it, host: " + host + ", skipping...");
    }

    var warehouseId = data.warehouseId;
    if (!warehouseId)
    {
        var application = gitana.application();
        if (application)
        {
            warehouseId = application.warehouseId;
        }
    }

    if (!warehouseId) {
        return console.log("Insight - the application does not have a warehouseId, skipping...");
    }

    var ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address;

    // tag all rows with the "applicationKey" + ip + host
    for (var i = 0; i < data.rows.length; i++)
    {
        data.rows[i].appKey = gitana.application().getId();

        if (!data.rows[i].source) {
            data.rows[i].source = {};
        }

        data.rows[i].source.ip = ip;
        data.rows[i].source.host = host;
    }

    // apply into PENDING_DATA
    if (!PENDING_DATA[warehouseId])
    {
        PENDING_DATA[warehouseId] = {
            "rows": []
        };
    }

    for (var i = 0; i < data.rows.length; i++)
    {
        PENDING_DATA[warehouseId].rows.push(data.rows[i]);
    }

    PENDING_DATA[warehouseId].gitana = gitana;
    PENDING_DATA[warehouseId].log = socket._log;
};

var doSend = function(callback)
{
    // first find a warehouseId that has some rows
    var warehouseId = null;

    for (var k in PENDING_DATA)
    {
        if (PENDING_DATA[k] && PENDING_DATA[k].rows && PENDING_DATA[k].rows.length > 0)
        {
            warehouseId = k;
            break;
        }
    }

    if (!warehouseId)
    {
        // nothing to send
        return callback();
    }

    var gitana = PENDING_DATA[warehouseId].gitana;
    var log = PENDING_DATA[warehouseId].log;

    // the data that we will send
    var data = {
        "rows": []
    };

    // move any PENDING_DATA for this warehouse into data.rows
    // this cuts down the PENDING_DATA array to size 0
    // and increases the size of data.rows
    while (PENDING_DATA[warehouseId].rows.length > 0) {
        data.rows.push(PENDING_DATA[warehouseId].rows.splice(0, 1)[0]);
    }

    // url over to cloud cms
    var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + "/warehouses/" + warehouseId + "/interactions/_create";
    var requestConfig = {
        "url": URL,
        "qs": {},
        "method": "POST",
        "json": data
    };

    console.log("Insight sync for warehouse: " + warehouseId + ", pushing rows: " + data.rows.length);
    console.log(" -> url: " + URL);
    console.log(" -> data: " + JSON.stringify(data));

    // make a single attempt to send the data over
    // if it fails, we add it back to the queue
    util.retryGitanaRequest(log, gitana, requestConfig, 1, function(err, response, body) {

        if (response && response.statusCode === 200 && body)
        {
            console.log("Insight sync for warehouse: " + warehouseId + " succeeded");
        }
        else
        {
            if (err || (body && body.error))
            {
                console.log("Insight sync for warehouse: " + warehouseId + " failed");

                if (err) {
                    console.log(" -> err: " + JSON.stringify(err));
                }

                /*
                // copy data.rows back into queue
                for (var z = 0; z < data.rows.length; z++)
                {
                    PENDING_DATA[warehouseId].rows.push(data.rows[z]);
                }
                */

                if (body && body.error)
                {
                    console.log(" -> body: " + JSON.stringify(body));
                }
            }
        }

        callback();
    });
};

var f = function() {
    setTimeout(function () {
        doSend(function() {
            f();
        });
    }, 250);
};
f();

