var path = require("path");

/**
 * No Operation (noop) provider.
 *
 * @type {*}
 */
exports = module.exports = function(broadcastConfig)
{
    var nrp = null;

    var r = {};

    r.start = function(callback)
    {
        callback();
    };

    r.publish = function(topic, message, callback)
    {
        callback();
    };

    r.subscribe = function(topic, fn, callback)
    {
        callback();
    };

    r.unsubscribe = function(topic, fn, callback)
    {
        callback();
    };

    return r;
};