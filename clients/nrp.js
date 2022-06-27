// a revision of
// https://raw.githubusercontent.com/louischatriot/node-redis-pubsub/master/lib/node-redis-pubsub.js
// that works with Redis 6+

"use strict";
var redis = require('redis');

/**
 * Create a new NodeRedisPubsub instance that can subscribe to channels and publish messages
 * @param {Object} options Options for the client creations:
 *                 client - a connected Redis client
 *                 scope - Optional, two NodeRedisPubsubs with different scopes will not share messages
 */
function NodeRedisPubsub(options)
{
    if (!(this instanceof NodeRedisPubsub)){ return new NodeRedisPubsub(options); }
    
    options || (options = {});
    
    this.emitter = options.client.duplicate();
    this.emitter.setMaxListeners(0);
    this.receiver = options.client.duplicate();
    this.receiver.setMaxListeners(0);
    
    this.prefix = options.scope ? options.scope + ':' : '';
}

NodeRedisPubsub.prototype.connect = function(callback)
{
    var self = this;
    
    (async function() {
        await self.emitter.connect();
        await self.receiver.connect();
        callback();
    })();
};

/**
 * Subscribe to a channel
 * @param {String} channel The channel to subscribe to, can be a pattern e.g. 'user.*'
 * @param {Function} handler Function to call with the received message.
 * @param {Function} cb Optional callback to call once the handler is registered.
 */
NodeRedisPubsub.prototype.on = NodeRedisPubsub.prototype.subscribe = function(channel, handler, callback)
{
    if (!callback)
    {
        callback = function(){};
    }
    
    var self = this;
    
    if (channel === "error")
    {
        self.errorHandler = handler;
        self.emitter.on("error", handler);
        self.receiver.on("error", handler);
        return callback();
    }
    
    var listener = function(self, handler)
    {
        return function(message, channel) {
            
            var jsonmsg = message;
            try{
                jsonmsg = JSON.parse(message);
            } catch (ex){
                if(typeof self.errorHandler === 'function'){
                    return self.errorHandler("Invalid JSON received! Channel: " + self.prefix + channel + " Message: " + message);
                }
            }
            return handler(jsonmsg, channel);
        }
    }(self, handler);
    
    (async function() {
        await self.receiver.pSubscribe(self.prefix + channel, listener);
    })();
    
    callback();
};

/**
 * Emit an event
 * @param {String} channel Channel on which to emit the message
 * @param {Object} message
 */
NodeRedisPubsub.prototype.emit = NodeRedisPubsub.prototype.publish = function (channel, message)
{
    var self = this;
    
    (async function() {
        return await self.emitter.publish(self.prefix + channel, JSON.stringify(message));
    })();
};

/**
 * Safely close the redis connections 'soon'
 */
NodeRedisPubsub.prototype.quit = function()
{
    this.emitter.quit();
    this.receiver.quit();
};

/**
 * Dangerously close the redis connections immediately
 */
NodeRedisPubsub.prototype.end = function()
{
    this.emitter.end(true);
    this.receiver.end(true);
};

module.exports = NodeRedisPubsub;