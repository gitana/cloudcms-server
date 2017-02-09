var path = require("path");

var async = require("async");

/**
 * A local process provider.
 *
 * @type {*}
 */
exports = module.exports = function(broadcastConfig)
{
    var subscribers = {};

    var r = {};

    var fnCounter = 0;

    r.start = function(callback)
    {
        callback();
    };

    r.publish = function(topic, message, callback)
    {
        var handlers = subscribers[topic];
        if (handlers)
        {
            var fns = [];
            for (var i = 0; i < handlers.length; i++)
            {
                var fn = function(handler, i, message) {
                    return function(done) {
                        var channel = {};
                        handlers[i](message, channel, function(err) {
                            done(err);
                        });
                    };
                }(handlers[i], i, message);
                fns.push(fn);
            }

            async.series(fns, function() {
                callback();
            });
        }
        else
        {
            callback();
        }
    };

    r.subscribe = function(topic, fn, callback)
    {
        var handlers = subscribers[topic];
        if (!handlers)
        {
            handlers = [];
            subscribers[topic] = handlers;
        }

        fn._id = fnCounter++;

        handlers.push(fn);

        callback();
    };

    r.unsubscribe = function(topic, fn, callback)
    {
        var handlers = subscribers[topic];
        if (handlers)
        {
            var removeIndex = -1;

            for (var i = 0; i < handlers.length; i++)
            {
                if (handlers[i]._id === fn._id) {
                    removeIndex = i;
                    break;
                }
            }

            if (removeIndex > -1)
            {
                handlers.splice(removeIndex, 1);
            }
        }
        callback();
    };

    return r;
};