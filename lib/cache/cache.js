var path = require("path");

exports = module.exports = function(basePath)
{
    var map = {};

    var _key = function(req)
    {
        var applicationId = req.applicationId;
        var principalId = req.principalId;

        return "cacheKey_" + applicationId + "_" + principalId;
    };

    var read = function(req, key)
    {
        var cacheKey = _key(req);

        var obj = null;
        if (map[cacheKey] && map[cacheKey][key])
        {
            obj = map[cacheKey][key]
        }

        return obj;
    };

    var clearAll = function()
    {
        map = {};
    };

    var clear = function(req)
    {
        var cacheKey = _key(req);

        if (map[cacheKey]) {
            delete map[cacheKey];
        }
    };

    var write = function(req, key, value)
    {
        var cacheKey = _key(req);

        if (!map[cacheKey])
        {
            map[cacheKey] = {};
        }

        map[cacheKey][key] = value;

        return value;
    };

    var r = {};

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
                var cacheHelper = {
                    read: function(key) {
                        return read(req, key);
                    },
                    write: function(key, value) {
                        return write(req, key, value);
                    },
                    clear: function() {
                        return clear(req);
                    }
                };
                req.cache = cacheHelper;
            }

            next();
        }
    };

    return r;
};