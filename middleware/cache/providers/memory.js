var path = require("path");

/**
 * In-memory cache.
 *
 * @type {*}
 */
exports = module.exports = function(cacheConfig)
{
    var valueMap = null;
    var expirationTimeMap = null;

    var r = {};

    r.init = function(callback)
    {
        valueMap = {};
        expirationTimeMap = {};

        callback();
    };

    r.write = function(key, value, seconds, callback)
    {
        valueMap[key] = value;

        if (seconds > -1)
        {
            expirationTimeMap[key] = Date.now() + (seconds * 1000);
        }

        callback();
    };

    r.read = function(key, callback)
    {
        var value = valueMap[key];

        var expirationTime = expirationTimeMap[key];
        if (expirationTime)
        {
            var now = Date.now();
            if (now > expirationTime)
            {
                delete valueMap[key];
                delete expirationTimeMap[key];
                value = null;
            }
        }

        callback(null, value);
    };

    r.remove = function(key, callback)
    {
        delete valueMap[key];
        delete expirationTimeMap[key];

        callback();
    };

    r.keys = function(prefix, callback)
    {
        var keys = [];

        for (var k in valueMap)
        {
            if (k.indexOf(prefix) > -1)
            {
                keys.push(k);
            }
        }

        callback(null, keys);
    };

    return r;
};