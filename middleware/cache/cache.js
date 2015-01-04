var path = require("path");
var async = require("async");

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
exports = module.exports = function()
{
    var provider = null;

    var __key = function(applicationId, principalId)
    {
        var prefix = applicationId;
        if (principalId) {
            prefix = path.join(prefix, principalId);
        }

        return prefix;
    };

    var r = {};

    var init = r.init = function(callback)
    {
        if (!process.env.CLOUDCMS_CACHE_TYPE)
        {
            process.env.CLOUDCMS_CACHE_TYPE = "memory";
        }

        if (!process.configuration.cache.type)
        {
            process.configuration.cache.type = process.env.CLOUDCMS_CACHE_TYPE;
        }

        if (!process.configuration.cache.config)
        {
            process.configuration.cache.config = {};
        }

        var cacheConfig = process.configuration.cache.config;

        provider = require("./providers/" + process.configuration.cache.type)(cacheConfig);
        provider.init(function(err) {
            callback(err);
        });
    };

    var write = r.write = function(key, value, seconds, callback)
    {
        if (typeof(seconds) == "function")
        {
            callback = seconds;
            seconds = -1;
        }

        provider.write(key, value, seconds, function(err, res) {
            callback(err, res);
        });
    };

    var read = r.read = function(key, callback)
    {
        provider.read(key, function(err, value) {
            callback(err, value);
        });
    };

    var remove = r.remove = function(key, callback)
    {
        provider.remove(key, null, function(err) {
            callback(err);
        });
    };

    var keys = r.keys = function(prefix, callback)
    {
        provider.keys(prefix, function(err, keys) {
            callback(err, keys);
        });
    };

    var invalidate = r.invalidate = function(prefix, callback)
    {
        keys(prefix, function(err, badKeys) {

            var fns = [];
            for (var i = 0; i < badKeys.length; i++) {
                var fn = function(callback) {
                    remove(badKeys[i], function() {
                        callback();
                    });
                };
                fns.push(fn);
            }
            async.parallel(fns, function() {
                callback();
            })
        });
    };

    var invalidateCacheForApp = r.invalidateCacheForApp = function(applicationId)
    {
        var prefix = __key(applicationId);

        return invalidate(prefix);
    };

    var __cacheBuilder = function(cache, applicationId, principalId)
    {
        var prefix = __key(applicationId, principalId);

        return require("./wrapper")(cache, prefix, provider);
    };

    /**
     * Binds a cache helper to the request.
     *
     * @return {Function}
     */
    r.cacheInterceptor = function()
    {
        var self = this;

        return function(req, res, next)
        {
            /*
            if (req.applicationId && req.principalId)
            {
                req.cache = __cacheBuilder(req.applicationId, req.principalId);
            }
            */

            if (req.applicationId)
            {
                req.cache = __cacheBuilder(self, req.applicationId);
            }

            next();
        }
    };

    return r;
}();