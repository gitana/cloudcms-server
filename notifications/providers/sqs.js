var AWS = require("aws-sdk");

var holder = {};

module.exports = {};
module.exports.start = function(configuration, callback)
{
    if (!configuration.queueUrl)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_SQS_QUEUE_URL)
        {
            configuration.queueUrl = process.env.CLOUDCMS_NOTIFICATIONS_SQS_QUEUE_URL;
        }
    }
    if (!configuration.accessKey)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_SQS_ACCESS_KEY)
        {
            configuration.accessKey = process.env.CLOUDCMS_NOTIFICATIONS_SQS_ACCESS_KEY;
        }
    }
    if (!configuration.secretKey)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_SQS_SECRET_KEY)
        {
            configuration.secretKey = process.env.CLOUDCMS_NOTIFICATIONS_SQS_SECRET_KEY;
        }
    }
    if (!configuration.region)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_SQS_REGION)
        {
            configuration.region = process.env.CLOUDCMS_NOTIFICATIONS_SQS_REGION;
        }
    }

    var queueUrl = configuration.queueUrl;
    var accessKey = configuration.accessKey;
    var secretKey = configuration.secretKey;
    var region = configuration.region;

    // adjust queueUrl to http for now since there are memory issues with https, node and the AWS SQS driver
    if (queueUrl && queueUrl.indexOf("https:") === 0)
    {
        queueUrl = "http:" + queueUrl.substring(6);
    }

    console.log("Connecting to queue: " + queueUrl);

    if (!holder.sqs)
    {
        holder.sqs = new AWS.SQS({
            "accessKeyId": accessKey,
            "secretAccessKey": secretKey,
            "region": region//,
            //"sslEnabled": false // to protect against possible memory leak?
        });

        holder.sqsParams = {
            QueueUrl: queueUrl,
            AttributeNames: [
                "All"
            ],
            MaxNumberOfMessages: 10,
            VisibilityTimeout: 30, // 30 seconds block message
            WaitTimeSeconds: 20 // long polling, avoid excessive connections
        };

        callback();
    }
    else
    {
        callback();
    }
};

module.exports.process = function(callback)
{
    var sqs = holder.sqs;
    if (!sqs)
    {
        return callback();
    }

    var sqsParams = holder.sqsParams;
    if (!sqsParams)
    {
        return callback();
    }

    sqs.receiveMessage(sqsParams, function (err, data) {

        if (err)
        {
            console.log("ERR1: " + err);
            return callback(err);
        }

        // build out the notification message items
        var items = [];
        if (data && data.Messages)
        {
            for (var i = 0; i < data.Messages.length; i++)
            {
                var message = data.Messages[i];

                var messageId = message.MessageId;

                var body = JSON.parse(message.Body);

                var subject = body.Subject;
                var timestamp = body.Timestamp;
                var sentTimestamp = message.Attributes.SentTimestamp;

                var item = null;
                try
                {
                    item = JSON.parse(body.Message);
                }
                catch (e)
                {
                    // oh well, not something we can deal with
                }

                if (!item) {
                    item = {};
                }

                // unique message id
                item._id = messageId;

                // keep this around so that we can delete later
                item._deletionEntry = {
                    "Id": "message" + i,
                    "ReceiptHandle": message.ReceiptHandle
                };

                // other properties
                item.timestamp = timestamp;
                item.sentTimestamp = sentTimestamp;
                item.subject = subject;

                // raw message
                item.rawMessage = body.Message;

                items.push(item);
            }
        }

        // call back to notifications engine to process these items
        // when they're done processing, our callback is fired so that we can handle deletes and things
        // we call the done() method when we're finished
        callback(null, items, function(err, items, done) {

            var deletionEntries = [];
            for (var i = 0; i < items.length; i++)
            {
                deletionEntries.push(items[i]._deletionEntry);
            }
            if (deletionEntries.length === 0)
            {
                return done(null, items, []);
            }

            var params = {
                Entries: deletionEntries,
                QueueUrl: holder.sqsParams.QueueUrl
            };
            sqs.deleteMessageBatch(params, function(err2, data) {

                if (err2)
                {
                    console.log("Error while deleting deletionEntries");
                    console.log(err2, err.stack);
                }

                done(err, items, items);
            });

        });

    });
};
