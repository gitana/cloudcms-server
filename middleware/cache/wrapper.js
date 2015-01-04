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

    r.write = function(key, value, callback)
    {
        var key = _toPrefixedKey(key);

        provider.write(key, value, function(err, res) {
            callback(err, res);
        });
    };

    r.read = function(key, callback)
    {
        var key = _toPrefixedKey(key);

        provider.read(key, function(err, value) {
            callback(err, value);
        });
    };

    r.remove = function(key, callback)
    {
        var key = _toPrefixedKey(key);

        provider.remove(key, null, function(err) {
            callback(err);
        });
    };

    r.keys = function(prefix, callback)
    {
        var prefix = _toPrefixedKey(prefix);

        provider.keys(prefix, function(err) {
            callback(err);
        });
    };

    r.invalidate = function(prefix, callback)
    {
        var prefix = _toPrefixedKey(prefix);

        cache.invalidate(prefix, function(err) {
            callback(err);
        });
    };

    r.invalidateCacheForApp = function(applicationId, callback)
    {
        cache.invalidateCacheForApp(prefix, function(err) {
            callback(err);
        });
    };

    return r;
};