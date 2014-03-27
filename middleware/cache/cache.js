var path = require("path");

/**
 * Cache middleware.
 *
 * Provides a singleton global cache as well as a cache builder that produces caches which are scoped to the current
 * application and authenticated user.
 *
 * Provides interceptor so that scoped cache is bound to request.
 *
 * @type {*}
 */
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

    var clear = r.clear = function(cacheKey, key)
    {
        if (key)
        {
            if (map[cacheKey] && map[cacheKey][key])
            {
                delete map[cacheKey][key];
            }
        }
        else
        {
            if (map[cacheKey])
            {
                delete map[cacheKey];
            }
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

    var each = r.each = function(cacheKey, callback)
    {
        if (!map[cacheKey])
        {
            map[cacheKey] = {};
        }

        for (var key in map[cacheKey])
        {
            var value = map[cacheKey][key];
            callback(key, value);
        }
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