const { Kafka } = require("kafkajs");
const util = require("../../util/util");

var holder = {};

module.exports = {};
module.exports.start = function(configuration, callback)
{
    // clientId
    if (!configuration.clientId)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_KAFKA_CLIENT_ID)
        {
            configuration.clientId = process.env.CLOUDCMS_NOTIFICATIONS_KAFKA_CLIENT_ID;
        }
    }
    if (!configuration.clientId)
    {
        configuration.clientId = "cloudcms-ui-kafka-notifications-client";
    }

    // topic
    if (!configuration.topic)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_KAFKA_TOPIC)
        {
            configuration.topic = process.env.CLOUDCMS_NOTIFICATIONS_KAFKA_TOPIC;
        }
    }
    if (!configuration.topic)
    {
        configuration.topic = "cloudcms.ui.topic";
    }
    
    // group
    if (!configuration.group)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_KAFKA_GROUP)
        {
            configuration.group = process.env.CLOUDCMS_NOTIFICATIONS_KAFKA_GROUP;
        }
    }
    if (!configuration.group) {
        configuration.group = "cloudcms-ui-kafka-notifications-group";
    }
    
    // brokers
    if (!configuration.brokers)
    {
        if (process.env.CLOUDCMS_NOTIFICATIONS_KAFKA_BROKERS)
        {
            configuration.brokers = process.env.CLOUDCMS_NOTIFICATIONS_KAFKA_BROKERS;
        }
    }
    
    var clientId = configuration.clientId;
    var brokers = configuration.brokers.split(",");
    var topic = configuration.topic;
    var group = configuration.group;

    process.log("Connecting to kafka, client ID: " + clientId + ", brokers: " + brokers + ", topic: " + topic + ", group: " + group);

    if (holder.consumer)
    {
        return callback();
    }
    
    // console.log("a1");
    var kafka = new Kafka({
        clientId: clientId,
        brokers: brokers
    });
    // console.log("a2: " + kafka);
    // console.log("a3: " + kafka.consumer);
    
    var consumer = holder.consumer = kafka.consumer({ groupId: group });
 
    // connect
    (async function() {
        await consumer.connect()
    }());
    
    (async function() {
        await consumer.subscribe({topic: topic, fromBeginning: true})
    }());
    
    callback();
};

module.exports.process = function(callback)
{
    var consumer = holder.consumer;
    if (!consumer)
    {
        return callback();
    }
    
    (async function() {
        await consumer.run({
            eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
                handleMessage(topic, partition, message, heartbeat, pause, callback);
            }
        });
    }());
};

var handleMessage = function(topic, partition, messageObject, heartbeat, pause, callback)
{
    // console.log("Topic: " + topic);
    // console.log("Partition: " + partition);
    // console.log("Message: " + JSON.stringify(messageObject, null, 2));
    
    if (!messageObject || !messageObject.value)
    {
        return;
    }
    
    //var key = message.key.toString();
    var valueString = messageObject.value.toString();
    var headers = messageObject.headers || {};
    
    var json = null;
    if (valueString) {
        json = JSON.parse("" + valueString);
    }
    
    // console.log("b1: " + valueString);
    // console.log("b2: " + data);
    
    if (json)
    {
        console.log("JSON: " + JSON.stringify(json));
        console.log("HEADERS: " + JSON.stringify(headers));
    
        /**
         * kafka1-ui-1  | VAL: {"subject":"invalidate_objects:aea334cb8accb0bd698e","message":"","data":"{\"operation\":\"invalidate_objects\",\"invalidations\":[{\"applicationId\":\"1785c4b13f74b3aa4b31\",\"ref\":\"application://826a3ebefe4c1e006a60/1785c4b13f74b3aa4b31\",\"id\":\"1785c4b13f74b3aa4b31\",\"type\":\"application\",\"stackId\":\"a17879ca0923f6d9696b\",\"stackMembers\":{\"archives\":{\"typeId\":\"vault\",\"id\":\"385e37eb07bc3d16dca1\"},\"console\":{\"typeId\":\"application\",\"id\":\"1785c4b13f74b3aa4b31\"},\"content\":{\"typeId\":\"repository\",\"id\":\"9904550a6b2a2a71f015\"},\"hosting\":{\"typeId\":\"webhost\",\"id\":\"5d2db66ced26608dc355\"},\"oneteam\":{\"typeId\":\"application\",\"id\":\"8d5ba57420ce31a3172c\"},\"principals\":{\"typeId\":\"domain\",\"id\":\"32cbffafe9f2de4d1b9a\"},\"root\":{\"typeId\":\"directory\",\"id\":\"6db38348323d001c2c10\"}}}]}"}
         * kafka1-ui-1  | HEADERS: [object Object]
         * @type {*[]}
         */
        
        var subject = json.subject;
        var message = json.message;
        
        // build out the notification message items
        var items = [];
    
        if (json.data)
        {
            var data = JSON.parse("" + json.data);

            // timestamp from headers
            //var timestamp = parseInt(headers.timestamp);
            var timestamp = new Date().getTime();
        
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
            item.rawMessage = json.data; // string
        
            items.push(item);
        
            //console.log("ITEM: " + JSON.stringify(item));
        }
    }
    
    // call back to notifications engine to process these items
    // when they're done processing, our callback is fired so that we can handle deletes and things
    // we call the done() method when we're finished
    callback(null, items, function(err, items, done) {
        done(err, items, items);
    });
};
