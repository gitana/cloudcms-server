var Stomp = require('stomp-client');
var util = require("../../util/util");

var holder = {};

var receivedMessages = [];

module.exports = {};
module.exports.start = function(configuration, callback)
{
    if (!configuration.host)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_STOMP_HOST)
        {
            configuration.host = process.env.CLOUDCMS_NOTIFICATIONS_STOMP_HOST;
        }
    }
    if (!configuration.port)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_STOMP_PORT)
        {
            configuration.port = process.env.CLOUDCMS_NOTIFICATIONS_STOMP_PORT;
        }
    }
    if (!configuration.username)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_STOMP_USERNAME)
        {
            configuration.username = process.env.CLOUDCMS_NOTIFICATIONS_STOMP_USERNAME;
        }
    }
    if (!configuration.password)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_STOMP_PASSWORD)
        {
            configuration.password = process.env.CLOUDCMS_NOTIFICATIONS_STOMP_PASSWORD;
        }
    }
    if (!configuration.queueUrl)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_STOMP_QUEUE_URL)
        {
            configuration.queueUrl = process.env.CLOUDCMS_NOTIFICATIONS_STOMP_QUEUE_URL;
        }
    }

    var host = configuration.host;
    var port = configuration.port;
    var username = configuration.username;
    var password = configuration.password;
    var queueUrl = configuration.queueUrl;

    //console.log("Stomp Configuration");
    //console.log(JSON.stringify(configuration, null, 2));

    // ensure port is numeric
    if (typeof(port) === "string") {
        port = parseInt(port, 10);
    }

    if (!holder.consumer)
    {
        var MessageConsumer = function MessageConsumer() { };
        MessageConsumer.prototype.init = function init(done) {
            console.log("STOMP client initializing to host: " + host + ", port: " + port);
            var stompClient = new Stomp({
                "host": host,
                "port": port,
                "user": username,
                "password": password,
                "protocolVersion": "1.0"
            });
            stompClient.connect(function(sessionId) {
                console.log("STOMP client connected with session ID: " + sessionId);
                stompClient.subscribe(queueUrl, function(payload, headers) {

                    //console.log("Heard: " + JSON.stringify(payload, null, 2));

                    // this gets called when we receive a message
                    // we simply push it onto an array for handling later
                    receivedMessages.push({
                        "payload": payload,
                        "headers": headers
                    });
                });

                done();
            });
        };
        holder.consumer = new MessageConsumer();
        holder.consumer.init(function(err) {
            callback(err);
        });
    }
    else
    {
        callback();
    }
};

module.exports.process = function(callback)
{
    var consumer = holder.consumer;
    if (!consumer)
    {
        return callback();
    }

    // messages are loaded in the callback above
    // here we simply check if the messages array has something and hand it back (and clear it)

    var x = receivedMessages.length;
    if (x > -1)
    {
        // splice off the messages we'll work on into a separate array
        // this allows for concurrent operations (something could be writing into the array from the queue while we work here)

        var workMessages = receivedMessages.splice(0, x);
        //console.log("Picked off work messages: " + JSON.stringify(workMessages));

        // build out the notification message items
        var items = [];
        if (workMessages && workMessages.length > 0)
        {
            for (var i = 0; i < workMessages.length; i++)
            {
                var payloadText = workMessages[i].payload;
                var headers = workMessages[i].headers;

                // assume body is JSON
                var payload = null;
                try
                {
                    payload = JSON.parse("" + payloadText);
                }
                catch (e)
                {
                    // failed to parse body, log why
                    console.log("Caught error on dataText parse for STOMP: " + JSON.stringify(e));
                }

                if (payload)
                {
                    var subject = payload.subject;
                    //var message = payload.message;
                    var dataText = payload.data;

                    var data = null;
                    try
                    {
                        data = JSON.parse("" + dataText);
                    }
                    catch (e)
                    {
                        // failed to parse data, log why
                        console.log("Caught error on payload dataText parse for STOMP: " + JSON.stringify(e));
                    }

                    if (data)
                    {
                        // timestamp from headers
                        var timestamp = parseInt(headers.timestamp);

                        // copy data as item
                        var item = util.clone(data, true);
                        if (!item)
                        {
                            item = {};
                        }

                        // other properties
                        item.timestamp = timestamp;
                        item.sentTimestamp = timestamp;
                        item.subject = subject;

                        // raw message
                        item.rawMessage = payloadText; // string

                        items.push(item);

                        //console.log("ITEM: " + JSON.stringify(item));
                    }
                }
            }
        }

        callback(null, items, function (err, items, done) {
            done(null, items, items);
        });
    }
};
