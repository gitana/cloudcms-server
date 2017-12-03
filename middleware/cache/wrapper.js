var path = require("path");

/**
 * Wraps a cache provider for a given prefix.
 *
 * @type {*}
 */
exports = module.exports = function(cache, basePrefix, defaultConfig)
{
    if (!defaultConfig) {
        defaultConfig = {};
    }

    var _toPrefixedKey = function(key)
    {
        var prefixedKey = key;

        if (basePrefix)
        {
            if (key) {
                prefixedKey = path.join(basePrefix, key);
            } else {
                prefixedKey = basePrefix;
            }

        }

        return prefixedKey;
    };

    var r = {};

    r.write = function(key, value, config, callback)
    {
        if (typeof(config) === "function") {
            callback = config;
            config = defaultConfig;
        }

        var prefixedKey = _toPrefixedKey(key);

        cache.write(prefixedKey, value, config, function(err, res) {

            if (callback)
            {
                callback(err, res);
            }

        });
    };

    r.read = function(key, callback)
    {
        var prefixedKey = _toPrefixedKey(key);

        cache.read(prefixedKey, function(err, value) {
            callback(err, value);
        });
    };

    r.remove = function(key, callback)
    {
        var prefixedKey = _toPrefixedKey(key);

        cache.remove(prefixedKey, function(err) {

            if (callback)
            {
                callback(err);
            }

        });
    };

    r.keys = function(prefix, callback)
    {
        if (typeof(prefix) === "function") {
            callback = prefix;
            prefix = null;
        }

        var prefixedKey = _toPrefixedKey(prefix);

        cache.keys(prefixedKey, function(err, keys) {
            callback(err, keys);
        });
    };

    r.invalidate = function(prefix, callback)
    {
        if (typeof(prefix) === "function") {
            callback = prefix;
            prefix = null;
        }

        var prefixedKey = _toPrefixedKey(prefix);

        cache.invalidate(prefixedKey, function(err) {

            if (callback)
            {
                callback(err);
            }

        });
    };

    return r;
};