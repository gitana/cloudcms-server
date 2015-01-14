var path = require("path");

/**
 * Wraps a cache provider for a given prefix.
 *
 * @type {*}
 */
exports = module.exports = function(cache, prefix, provider)
{
    var _toPrefixedKey = function(key)
    {
        return path.join(prefix, key);
    };

    var r = {};

    r.write = function(key, value, seconds, callback)
    {
        var prefixedKey = _toPrefixedKey(key);

        provider.write(prefixedKey, value, seconds, function(err, res) {

            if (callback)
            {
                callback(err, res);
            }

        });
    };

    r.read = function(key, callback)
    {
        var prefixedKey = _toPrefixedKey(key);

        provider.read(prefixedKey, function(err, value) {
            callback(err, value);
        });
    };

    r.remove = function(key, callback)
    {
        var prefixedKey = _toPrefixedKey(key);

        provider.remove(prefixedKey, function(err) {

            if (callback)
            {
                callback(err);
            }

        });
    };

    r.keys = function(prefix, callback)
    {
        var prefixedKey = _toPrefixedKey(prefix);

        provider.keys(prefixedKey, function(err) {
            callback(err);
        });
    };

    r.invalidate = function(prefix, callback)
    {
        var prefixedKey = _toPrefixedKey(prefix);

        cache.invalidate(prefixedKey, function(err) {

            if (callback)
            {
                callback(err);
            }

        });
    };

    r.invalidateCacheForApp = function(applicationId, callback)
    {
        cache.invalidateCacheForApp(prefix, function(err) {

            if (callback)
            {
                callback(err);
            }

        });
    };

    return r;
};