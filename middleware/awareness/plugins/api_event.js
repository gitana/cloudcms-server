/*

this awareness plugin adds support for general purpose API events
the API in 4.0 supports passing API events forward via the message queue to the app server
the app server then converts these into notifications

the UI can register and event listener via socket.io ("onApiEvent").
a listener binds to an event type + an optional reference

when an event is received by the API, it triggers to socket.io emits (one for the general event and the other for the
event + the reference being acted upon)
 */
exports = module.exports = {};

var util = require("../../../util/util");
var socketUtil = require("../../../util/socket");

var subscriptionsBound = false;

var bindSubscriptions = function(io)
{
    if (subscriptionsBound) {
        return;
    }

    subscriptionsBound = true;
    
    // LISTEN: "api_event"
    process.broadcast.subscribe("api_event", function (message, channel, done) {
        
        if (!done) {
            done = function () {};
        }
    
        // the message
        // {
        //     "applicationId": applicationId,
        //     "deploymentKey": deploymentKey,
        //     "host": host,
        //     "eventType": eventType,
        //     "eventId": eventId,
        //     "objectType": objectType,
        //     "objectId": objectId,
        //     "objectRef": objectRef,
        //     "object": object.object
        // };
    
        var apiEvent = {};
        apiEvent.type = message.eventType;
        apiEvent.id = message.eventId;
        apiEvent.objectType = message.objectType;
        apiEvent.objectId = message.objectId;
        apiEvent.objectRef = message.objectRef;
        apiEvent.object = message.object;
        
        // dispatch for event + reference
        if (apiEvent.objectRef)
        {
            try {
                apiEvent.channelId = "apiEvent-" + apiEvent.type + "_" + apiEvent.objectRef;
                //console.log("api_event -> " + apiEvent.channelId);
                io.to(apiEvent.channelId).emit("apiEvent", apiEvent);
            } catch (e) {
                console.log(e);
            }
        }
    
        // dispatch for event
        try {
            apiEvent.channelId = "apiEvent-" + apiEvent.type;
            //console.log("apiEvent -> " + apiEvent.channelId);
            io.to(apiEvent.channelId).emit("apiEvent", apiEvent);
        } catch (e) {
            console.log(e);
        }
        
        done();
    });
};

exports.bindSocket = function(socket, provider, io)
{
    bindSubscriptions(io);

    socketUtil.bindGitana(socket, function() {

        socket.on("onApiEvent", function(eventName, reference, callback) {

            if (eventName)
            {
                var channelId = "apiEvent-" + eventName;
                
                if (reference)
                {
                    channelId = eventName + "-" + reference;
                }
                
                // join room for this event
                socket.join(channelId);
            }

            callback();
        });
    });
};
