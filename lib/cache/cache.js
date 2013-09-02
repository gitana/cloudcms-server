var path = require("path");

exports = module.exports = function(basePath)
{
    var map = {};

    var _key = function(req)
    {
        var applicationId = req.applicationId;
        var principalId = req.principalId;

        return __key(applicationId, principalId);
    };

    var __key = function(applicationId, principalId)
    {
        return "cacheKey_" + applicationId + "_" + principalId;
    };

    var r = {};

    var read = r.read = function(cacheKey, key)
    {
        var obj = null;

        if (map[cacheKey] && map[cacheKey][key])
        {
            obj = map[cacheKey][key]
        }

        return obj;
    };

    var clear = r.clear = function(cacheKey)
    {
        if (map[cacheKey]) {
            delete map[cacheKey];
        }
    };

    var write = r.write = function(cacheKey, key, value)
    {
        if (!map[cacheKey])
        {
            map[cacheKey] = {};
        }

        map[cacheKey][key] = value;

        return value;
    };

    var cacheBuilder = r.cacheBuilder = function(cacheKey)
    {
        var x = {};

        x.read = function(key) {
            return read(cacheKey, key);
        };
        x.write = function(key, value) {
            return write(cacheKey, key, value);
        };
        x.clear = function() {
            return clear(cacheKey);
        };

        return x;
    };

    /**
     * Binds a cache helper to the request.
     *
     * @return {Function}
     */
    r.cacheInterceptor = function()
    {
        return function(req, res, next)
        {
            if (req.applicationId && req.principalId)
            {
                var cacheKey = _key(req);

                req.cache = cacheBuilder(cacheKey);
            }

            next();
        }
    };

    return r;
};