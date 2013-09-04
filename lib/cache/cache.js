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
        var cacheKey = "cacheKey_" + applicationId;
        if (principalId) {
            cacheKey += "_" + principalId;
        }

        return cacheKey;
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

    var invalidateCacheForApp = r.invalidateCacheForApp = function(applicationId)
    {
        var prefix = __key(applicationId);

        return invalidate(prefix);
    };

    var invalidate = r.invalidate = function(prefix)
    {
        var badKeys = [];
        for (var k in map)
        {
            if (prefix)
            {
                if (k.indexOf(prefix) === 0)
                {
                    badKeys.push(k);
                }
            }
            else
            {
                badKeys.push(k);
            }
        }

        for (var i = 0; i < badKeys.length; i++)
        {
            console.log("Removing bad key from cache: " + badKeys[i]);
            delete map[badKeys[i]];
        }
    };

    var cacheBuilder = r.cacheBuilder = function(applicationId, principalId)
    {
        var cacheKey = __key(applicationId, principalId);

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
        x.invalidate = function() {
            return invalidate(__key(applicationId));
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
                req.cache = cacheBuilder(req.applicationId, req.principalId);
            }

            next();
        }
    };

    return r;
};