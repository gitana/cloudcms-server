var AWS = require("aws-sdk");

var holder = {};

var LAST_SENT_TIMESTAMP = -1;

module.exports = {};
module.exports.start = function(configuration, callback)
{
    if (process.env.CLOUDCMS_NOTIFICATIONS_SQS_QUEUE_URL)
    {
        configuration.queueUrl = process.env.CLOUDCMS_NOTIFICATIONS_SQS_QUEUE_URL;
    }
    if (process.env.CLOUDCMS_NOTIFICATIONS_SQS_ACCESS_KEY)
    {
        configuration.accessKey = process.env.CLOUDCMS_NOTIFICATIONS_SQS_ACCESS_KEY;
    }
    if (process.env.CLOUDCMS_NOTIFICATIONS_SQS_SECRET_KEY)
    {
        configuration.secretKey = process.env.CLOUDCMS_NOTIFICATIONS_SQS_SECRET_KEY;
    }
    if (process.env.CLOUDCMS_NOTIFICATIONS_SQS_REGION)
    {
        configuration.region = process.env.CLOUDCMS_NOTIFICATIONS_SQS_REGION;
    }

    var queueUrl = configuration.queueUrl;
    var accessKey = configuration.accessKey;
    var secretKey = configuration.secretKey;
    var region = configuration.region;

    if (!holder.sqs)
    {
        holder.sqs = new AWS.SQS({
            "accessKeyId": accessKey,
            "secretAccessKey": secretKey,
            "region": region
        });

        holder.sqsParams = {
            QueueUrl: queueUrl,
            AttributeNames: [
                "All"
            ],
            MaxNumberOfMessages: 10,
            VisibilityTimeout: 1,
            WaitTimeSeconds: 20 // long polling
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
        return;
    }

    var sqsParams = holder.sqsParams;
    if (!sqsParams)
    {
        return;
    }

    sqs.receiveMessage(sqsParams, function (err, data) {

        if (err)
        {
            callback(err);
            return;
        }

        var items = [];
        //var deletionEntries = [];

        var skipped = 0;
        var handled = 0;

        if (data && data.Messages)
        {
            var maxSentTimestamp = -1;

            for (var i = 0; i < data.Messages.length; i++)
            {
                var message = data.Messages[i];

                var messageId = message.MessageId;

                var sentTimestamp = message.Attributes.SentTimestamp;
                if (sentTimestamp > LAST_SENT_TIMESTAMP)
                {
                    // keep log of the max timestamp we're charged with dispatching
                    if (sentTimestamp > maxSentTimestamp)
                    {
                        maxSentTimestamp = sentTimestamp;
                    }

                    handled++;

                    var body = JSON.parse(message.Body);

                    var subject = body.Subject;
                    var timestamp = body.Timestamp;

                    var item = null;
                    try
                    {
                        item = JSON.parse(body.Message);
                    }
                    catch (e)
                    {
                        // oh well, not something we can deal with
                        console.log("Heard message but can't make sense of it: " + body.Message);
                        item = null;
                    }

                    // either way, purge message
                    //deletionEntries.push({
                    //    "Id": "message" + i, "ReceiptHandle": message.ReceiptHandle
                    //});

                    // if we got something
                    if (item)
                    {
                        // unique message id
                        item._id = messageId;

                        // other properties
                        item.timestamp = timestamp;
                        item.sentTimestamp = sentTimestamp;
                        item.subject = subject;

                        /*

                         {
                         "ResponseMetadata": {
                         "RequestId": "5cb68f40-8691-5d7d-a3d1-c251c05e7c44"
                         },
                         "Messages": [
                         {
                         "MessageId": "48aeb832-1b3b-44a2-a733-af4806fb69eb",
                         "ReceiptHandle": "AQEBuMXeGWF5ItV9a39g4hGly+pha3z6zM/pZ5CzbGr/1h+0Z2XtKvUJOk4r6H2fNqFE55ENx5nUebZPiiq0/AIVQfEzlquIAaTaM37hgPdh8PEB9TbKCzXFutRr/Nbvp5O4qJH+gLZYzsP9p8MJP/SP1iMhrZ19FaUBDQVOb73DfgbWDkxZpx22dprZfLBkgKmOwrlPDs5ieVqysM950lLMBrQHoUjlPYE9sv9FRzpqlC0ma4uURbcKGB/5JZ4XpGXo94PlhypPwZkODZeo567eOZ6lb35hr9AllmkoztS8qftoJwQID2jDySnVQ9IF5Xg4k+2lHx1e0avOCaZZ5SiEEvHBohZ3SNKWX0c0hr0qsjc=",
                         "MD5OfBody": "2f035cda3d5fde789e75194b0d0c1dca",
                         "Body": "{\n  \"Type\" : \"Notification\",\n  \"MessageId\" : \"9a0af2e5-7c86-51eb-9a5d-bff43a483277\",\n  \"TopicArn\" : \"arn:aws:sns:us-east-1:539235198345:cloudcms-net-development\",\n  \"Subject\" : \"update:db1e290e8642a3b8948b\",\n  \"Message\" : \"{\\\"ref\\\":\\\"node://66e01b6dabb0d99932a7/93ed53111af51f2aca90/9412a595b4f058455019/db1e290e8642a3b8948b\\\",\\\"applicationId\\\":\\\"6a79c4699d95d340a332\\\",\\\"id\\\":\\\"db1e290e8642a3b8948b\\\",\\\"deploymentKey\\\":\\\"test\\\",\\\"deployedApplicationId\\\":\\\"6a79c4699d95d340a332\\\",\\\"host\\\":\\\"testapp.dev-cloudcms.net\\\",\\\"operation\\\":\\\"update\\\"}\",\n  \"Timestamp\" : \"2014-12-21T22:07:10.078Z\",\n  \"SignatureVersion\" : \"1\",\n  \"Signature\" : \"zqI+HtIM30M/9NFKX1lyrHqIZMGI5tKDxZqhp7qNMwZ4hr0w4StCy/US4oQBsomt0cUnVqwneqOkm0bRawiVVfY6fCFazSlgPI6X0FuJ8x5XERTfQHVJFxxX2paBIHgGay6AdZ62a5UDTP0E8G7230oD0WbuE+HMR0Zun4wBsam1/9CqrwS7MKd0WwAiT7z4tGcG2C8W5GUgnkalSLtqzKZfzEYOg98b0BgY7KIXSWO3Pp+HzXAqrD7j4IanmWazCvFKXU4zrbF6gi+xP2aGLJF4azYGgkQXp/3lNNNS1F5RzQ4jDCA6MrPfpeOeadCUr1o745CrUBgYJH5u8i4MIA==\",\n  \"SigningCertURL\" : \"https://sns.us-east-1.amazonaws.com/SimpleNotificationService-d6d679a1d18e95c2f9ffcf11f4f9e198.pem\",\n  \"UnsubscribeURL\" : \"https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:539235198345:cloudcms-net-development:3a83ad32-64f0-40be-b4a2-c6e7f554d5da\"\n}",
                         "Attributes": {
                         "SenderId": "443302527238",
                         "ApproximateFirstReceiveTimestamp": "1419199631586",
                         "ApproximateReceiveCount": "1",
                         "SentTimestamp": "1419199630178"
                         }
                         },
                         {
                         "MessageId": "48aeb832-1b3b-44a2-a733-af4806fb69eb",
                         "ReceiptHandle": "AQEBKx4SlKvDptsCAipNZe9oAMEj73pTgrhCZxmMejQgHE19Asd3W+nxdouIE3s7FS4u5aYrZeTX4FJ9bNfZnZCA2nMYGBuKlpX9w2Qt5USPEvB7aWZnqGfRrLggNvpByVlbLT3JJ/BleCCmLTgqxmU/LG/LZgpiDYDHuqXan1x220I2Jh6fsRi7m52dhSNsHKOr6lvy/h+CziSFvPeJ2Wk/ocEomxcdIyglymszlWThUjrNITqBDi3lRgeuar1v5KhT94OtByCCBxmnpCuMDJaTD3jtfjFcHvUXm14s+6/i+AoMOzHkxp5mE+r/DSNm/GNuxpzB1kl4NQKX+niTwrnR8aNUwbwMlVmi9bo1pmW8hWA=",
                         "MD5OfBody": "2f035cda3d5fde789e75194b0d0c1dca",
                         "Body": "{\n  \"Type\" : \"Notification\",\n  \"MessageId\" : \"9a0af2e5-7c86-51eb-9a5d-bff43a483277\",\n  \"TopicArn\" : \"arn:aws:sns:us-east-1:539235198345:cloudcms-net-development\",\n  \"Subject\" : \"update:db1e290e8642a3b8948b\",\n  \"Message\" : \"{\\\"ref\\\":\\\"node://66e01b6dabb0d99932a7/93ed53111af51f2aca90/9412a595b4f058455019/db1e290e8642a3b8948b\\\",\\\"applicationId\\\":\\\"6a79c4699d95d340a332\\\",\\\"id\\\":\\\"db1e290e8642a3b8948b\\\",\\\"deploymentKey\\\":\\\"test\\\",\\\"deployedApplicationId\\\":\\\"6a79c4699d95d340a332\\\",\\\"host\\\":\\\"testapp.dev-cloudcms.net\\\",\\\"operation\\\":\\\"update\\\"}\",\n  \"Timestamp\" : \"2014-12-21T22:07:10.078Z\",\n  \"SignatureVersion\" : \"1\",\n  \"Signature\" : \"zqI+HtIM30M/9NFKX1lyrHqIZMGI5tKDxZqhp7qNMwZ4hr0w4StCy/US4oQBsomt0cUnVqwneqOkm0bRawiVVfY6fCFazSlgPI6X0FuJ8x5XERTfQHVJFxxX2paBIHgGay6AdZ62a5UDTP0E8G7230oD0WbuE+HMR0Zun4wBsam1/9CqrwS7MKd0WwAiT7z4tGcG2C8W5GUgnkalSLtqzKZfzEYOg98b0BgY7KIXSWO3Pp+HzXAqrD7j4IanmWazCvFKXU4zrbF6gi+xP2aGLJF4azYGgkQXp/3lNNNS1F5RzQ4jDCA6MrPfpeOeadCUr1o745CrUBgYJH5u8i4MIA==\",\n  \"SigningCertURL\" : \"https://sns.us-east-1.amazonaws.com/SimpleNotificationService-d6d679a1d18e95c2f9ffcf11f4f9e198.pem\",\n  \"UnsubscribeURL\" : \"https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:539235198345:cloudcms-net-development:3a83ad32-64f0-40be-b4a2-c6e7f554d5da\"\n}",
                         "Attributes": {
                         "SenderId": "443302527238",
                         "ApproximateFirstReceiveTimestamp": "1419199631586",
                         "ApproximateReceiveCount": "2",
                         "SentTimestamp": "1419199630178"
                         }
                         },
                         {
                         "MessageId": "48aeb832-1b3b-44a2-a733-af4806fb69eb",
                         "ReceiptHandle": "AQEBeDK9ONihETnKr3+IzWiujuEKOA//PEZji8MhQG+/IZd3tp9LGUykGxkGK6LrrEKS1RZmfGiGdk7TM/leI8tcWfSAm6Bg5xYsCg3qHv3kUP6RF2BtEbc3lEf0teax+6n+ta8gc5PYJ3H7MBTZ5w/4b0M+0nJSAQauJOZvNHkFVUs81r8wsnjx0vSbfJ+yh/UH8rMR3B+iiAzHv9YEawqgIQXlLSsB2LQg9cKHDM8bCtw6QTW5NVXnEnikAQE/N951kzRL2iB8aJlKSGw21opFm+HPMsb7S3qhzjtu5IGnBKVboqYf7U58FZvfZGxnKomhXFwXcrSoONtq11DF4qDpTtdLbK4aI2Ohuu90hwG2WVM=",
                         "MD5OfBody": "2f035cda3d5fde789e75194b0d0c1dca",
                         "Body": "{\n  \"Type\" : \"Notification\",\n  \"MessageId\" : \"9a0af2e5-7c86-51eb-9a5d-bff43a483277\",\n  \"TopicArn\" : \"arn:aws:sns:us-east-1:539235198345:cloudcms-net-development\",\n  \"Subject\" : \"update:db1e290e8642a3b8948b\",\n  \"Message\" : \"{\\\"ref\\\":\\\"node://66e01b6dabb0d99932a7/93ed53111af51f2aca90/9412a595b4f058455019/db1e290e8642a3b8948b\\\",\\\"applicationId\\\":\\\"6a79c4699d95d340a332\\\",\\\"id\\\":\\\"db1e290e8642a3b8948b\\\",\\\"deploymentKey\\\":\\\"test\\\",\\\"deployedApplicationId\\\":\\\"6a79c4699d95d340a332\\\",\\\"host\\\":\\\"testapp.dev-cloudcms.net\\\",\\\"operation\\\":\\\"update\\\"}\",\n  \"Timestamp\" : \"2014-12-21T22:07:10.078Z\",\n  \"SignatureVersion\" : \"1\",\n  \"Signature\" : \"zqI+HtIM30M/9NFKX1lyrHqIZMGI5tKDxZqhp7qNMwZ4hr0w4StCy/US4oQBsomt0cUnVqwneqOkm0bRawiVVfY6fCFazSlgPI6X0FuJ8x5XERTfQHVJFxxX2paBIHgGay6AdZ62a5UDTP0E8G7230oD0WbuE+HMR0Zun4wBsam1/9CqrwS7MKd0WwAiT7z4tGcG2C8W5GUgnkalSLtqzKZfzEYOg98b0BgY7KIXSWO3Pp+HzXAqrD7j4IanmWazCvFKXU4zrbF6gi+xP2aGLJF4azYGgkQXp/3lNNNS1F5RzQ4jDCA6MrPfpeOeadCUr1o745CrUBgYJH5u8i4MIA==\",\n  \"SigningCertURL\" : \"https://sns.us-east-1.amazonaws.com/SimpleNotificationService-d6d679a1d18e95c2f9ffcf11f4f9e198.pem\",\n  \"UnsubscribeURL\" : \"https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:539235198345:cloudcms-net-development:3a83ad32-64f0-40be-b4a2-c6e7f554d5da\"\n}",
                         "Attributes": {
                         "SenderId": "443302527238",
                         "ApproximateFirstReceiveTimestamp": "1419199631586",
                         "ApproximateReceiveCount": "3",
                         "SentTimestamp": "1419199630178"
                         }
                         }
                         ]
                         }
                         */

                        items.push(item);
                    }
                }
                else
                {
                    skipped++;
                }
            }

            // update our last counter so that we don't process messages twice
            if (maxSentTimestamp > LAST_SENT_TIMESTAMP) {
                LAST_SENT_TIMESTAMP = maxSentTimestamp;
            }
        }

        /*
        if (deletionEntries.length > 0)
        {
            //console.log("Deletions: " + deletionEntries.length);
            //console.log("Entries: " + JSON.stringify(deletionEntries));
            var params = {
                Entries: deletionEntries,
                QueueUrl: holder.sqsParams.QueueUrl
            };
            sqs.deleteMessageBatch(params, function(err2, data) {

                if (err2)
                {
                    console.log(err2, err.stack);
                }

                callback(err, items);
            });
        }
        else
        {
            callback(err, items);
        }
        */

        /*
        if (handled > 0)
        {
            console.log("SQS Provider handled: " + handled + ", skipped: " + skipped);
        }
        */

        callback(err, items);
    });
};
