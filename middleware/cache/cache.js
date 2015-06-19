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

    var r = {};

    var init = r.init = function(callback)
    {
        var self = this;

        if (!process.env.CLOUDCMS_CACHE_TYPE)
        {
            if (process.configuration.setup === "single")
            {
                process.env.CLOUDCMS_CACHE_TYPE = "memory";
            }
            else
            {
                process.env.CLOUDCMS_CACHE_TYPE = "shared-memory";
            }
        }

        if (!process.configuration.cache.type)
        {
            process.configuration.cache.type = process.env.CLOUDCMS_CACHE_TYPE;
        }

        if (!process.configuration.cache.config)
        {
            process.configuration.cache.config = {};
        }

        process.env.CLOUDCMS_CACHE_TYPE = process.configuration.cache.type;

        var cacheConfig = process.configuration.cache.config;

        provider = require("./providers/" + process.configuration.cache.type)(cacheConfig);
        provider.init(function(err) {

            // global caches
            process.deploymentDescriptorCache = createNamespacedCache.call(r, "descriptors");
            process.driverConfigCache = createNamespacedCache.call(r, "driverconfigs");

            callback(err);
        });
    };

    var write = r.write = function(key, value, seconds, callback)
    {
        if (typeof(seconds) === "function")
        {
            callback = seconds;
            seconds = -1;
        }

        provider.write(key, value, seconds, function(err, res) {
            if (callback)
            {
                callback(err, res);
            }
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
        provider.remove(key, function(err) {
            if (callback)
            {
                callback(err);
            }
        });
    };

    var keys = r.keys = function(prefix, callback)
    {
        if (typeof(prefix) === "function") {
            callback = prefix;
            prefix = null;
        }

        if (!prefix) {
            prefix = "";
        }

        provider.keys(prefix, function(err, keys) {

            // some cleanup
            if (!err && !keys) {
                keys = [];
            }

            callback(err, keys);
        });
    };

    var invalidate = r.invalidate = function(prefix, callback)
    {
        if (typeof(prefix) === "function") {
            callback = prefix;
            prefix = null;
        }

        if (!prefix) {
            prefix = "";
        }

        keys(prefix, function(err, badKeys) {

            var fns = [];
            for (var i = 0; i < badKeys.length; i++) {
                var fn = function(done) {
                    remove(badKeys[i], function() {
                        done();
                    });
                };
                fns.push(fn);
            }
            async.parallel(fns, function() {
                if (callback)
                {
                    callback();
                }
            })
        });
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // END OF CACHE INTERFACE
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////

    var __prefixedKey = function()
    {
        var prefix = null;

        var namespaces = Array.prototype.slice.call(arguments);
        if (namespaces.length > 0)
        {
            prefix = namespaces.join("/");
        }

        return prefix;
    };

    var invalidateCacheForApp = r.invalidateCacheForApp = function(applicationId, callback)
    {
        var prefixedKey = __prefixedKey(applicationId);

        return invalidate(prefixedKey, function(err) {
            if (callback)
            {
                callback(err);
            }
        });
    };

    var createNamespacedCache = r.createNamespacedCache = function()
    {
        var prefixedKey = __prefixedKey.apply(this, arguments);

        return require("./wrapper")(this, prefixedKey);
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
            if (req.applicationId)
            {
                req.cache = createNamespacedCache.call(self, req.applicationId);
            }

            next();
        }
    };

    r.deploymentDescriptorCache = function()
    {
        return process.deploymentDescriptorCache;
    };

    r.driverConfigCache = function()
    {
        return process.driverConfigCache;
    };

    return r;
}();