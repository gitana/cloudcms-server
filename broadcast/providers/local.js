var path = require("path");

/**
 * A local process provider.
 *
 * @type {*}
 */
exports = module.exports = function(broadcastConfig)
{
    var subscribers = {};

    var r = {};

    r.start = function(callback)
    {
        callback();
    };

    r.publish = function(topic, message, callback)
    {
        var handlers = subscribers[topic];
        if (handlers)
        {
            for (var i = 0; i < handlers.length; i++)
            {
                handlers[i](message);
            }
        }

        callback();
    };

    r.subscribe = function(topic, fn, callback)
    {
        var handlers = subscribers[topic];
        if (!handlers)
        {
            handlers = [];
            subscribers[topic] = handlers;
        }

        handlers.push(fn);

        callback();
    };

    r.unsubscribe = function(topic, fn, callback)
    {
        callback();
    };

    return r;
};