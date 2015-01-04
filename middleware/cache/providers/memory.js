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
            expirationTimeMap[key] = new Date().getTime() + (seconds * 1000);
        }

        if (callback)
        {
            callback();
        }
    };

    r.read = function(key, callback)
    {
        var value = valueMap[key];

        var expirationTime = expirationTimeMap[key];
        if (expirationTime)
        {
            var now = new Date().getTime();
            if (now > expirationTime)
            {
                delete valueMap[key];
                delete expirationTimeMap[key];
                value = null;
            }
        }

        if (callback)
        {
            callback(null, value);
        }
    };

    r.remove = function(key, callback)
    {
        delete valueMap[key];
        delete expirationTimeMap[key];

        if (callback)
        {
            callback();
        }
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

        if (callback)
        {
            callback(null, keys);
        }
    };

    return r;
};