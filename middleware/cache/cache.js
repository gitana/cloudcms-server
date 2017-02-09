var path = require("path");
var async = require("async");

var util = require("../../util/util");

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
            process.subKeyMapCache = createNamespacedCache.call(r, "keyMap");

            // subscribe to node invalidation broadcast events
            process.broadcast.subscribe("node_invalidation", function (message, channel, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                var nodeId = message.nodeId;
                var branchId = message.branchId;
                var repositoryId = message.repositoryId;
                var host = message.host;

                invalidateNode(host, repositoryId, branchId, nodeId, function(err) {

                    if (message.isMasterBranch)
                    {
                        // for master branch, we make a second attempt using "master" as the branch ID
                        invalidateNode(host, repositoryId, "master", nodeId, function(err) {
                            invalidationDone(err);
                        });
                    }
                    else
                    {
                        invalidationDone(err);
                    }

                });

            });

            callback(err);
        });
    };

    // overload the "config" param so it can be either:
    // number of seconds
    // callback function
    // config object:
    // {
    //   "seconds": -1
    //   "subKeys": ["7543584a70136edb1545", "61defbdf2d2227c6654c"] // optional. used for invalidating cache objects by node id
    // }
    var write = r.write = function(key, value, config, callback)
    {        
        if (typeof(config) === "function")
        {
            callback = config;
            config = { 
                "seconds": -1
            };
        } else if (typeof(config) === "number" ) {
            config = {
                "seconds": config
            }
        } else if (typeof(config) === "object" ) {
            config.seconds = config.seconds || -1;
        } else {
            config = { 
                "seconds": -1
            };
        }

        if (config.subKeys) {
            // subKeys (a list of node IDs) are present so store a map for invalidation
            subKeyMapCache().read("keyMapCache", function(err, keyMapCache){
                var keyMap =  {};
                var keyInverseMap = {};

                if (keyMapCache)
                {
                    keyMap = keyMapCache.keyMapCache || {};
                    keyInverseMap = keyMapCache.keyInverseMapCache || {};
                }

                for(var i = 0; i < config.subKeys.length; i++)
                {
                    // subKeys are node IDs
                    var nodeId = config.subKeys[i];

                    if (keyInverseMap[key])
                    {
                        keyInverseMap[key][nodeId] = true;
                    }
                    else
                    {
                        keyInverseMap[key] = {};
                        keyInverseMap[key][nodeId] = true;
                    }

                    if (keyMap[nodeId])
                    {
                        keyMap[nodeId][key] = true;
                    }
                    else
                    {
                        keyMap[nodeId] = {};
                        keyMap[nodeId][key] = true;
                    }
                }

                keyMapCache = {
                    "keyMapCache": keyMap,
                    "keyInverseMapCache": keyInverseMap
                };

                subKeyMapCache().write("keyMapCache", keyMapCache, function(){
                    provider.write(key, value, config.seconds, function(err, res) {
                        if (callback)
                        {
                            callback(err, res);
                        }
                    });
                });
                
            });
        }
        else
        {
            provider.write(key, value, config.seconds, function(err, res) {
                if (callback)
                {
                    callback(err, res);
                }
            });
        }
    };

    var read = r.read = function(key, callback)
    {
        provider.read(key, function(err, value) {
            callback(err, value);
        });
    };

    var remove = r.remove = function(key, callback)
    {
        subKeyMapCache().read("keyMapCache", function(err, keyMapCache){
            var keyMap =  {};
            var keyInverseMap = {};

            if (keyMapCache)
            {
                keyMap = keyMapCache.keyMapCache || {};
                keyInverseMap = keyMapCache.keyInverseMapCache || {};
            }

            var _keys = Object.keys(keyInverseMap);
            if (_keys[key])
            {
                var _key = _keys[key];
                for(var i = 0; i < _keys.length; i++)
                {
                    if (keyMap[key])
                    {
                        var nodeIds = Object.keys(keyMap[key]);
                        for(var j = 0; j < nodeIds.length; j++)
                        {
                            delete keyMap[nodeIds[j]][key];
                        }                        
                    }

                    if (keyInverseMap[key])
                    {
                        delete keyInverseMap[key];
                    }
                }

                keyMapCache = {
                    "keyMapCache": keyMap,
                    "keyInverseMapCache": keyInverseMap
                };

                subKeyMapCache().write("keyMapCache", keyMapCache, function(){
                    provider.remove(key, function(err) {
                        if (callback)
                        {
                            callback(err);
                        }
                    });
                });
                
            }
            else
            {
                provider.remove(key, function(err) {
                    if (callback)
                    {
                        callback(err);
                    }
                });
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
            var createRemoveTask = function(key) {
                return function(done) {
                    remove(key, function() {
                        done();
                    });
                };
            };

            var fns = [];
            for (var i = 0; i < badKeys.length; i++)
            {
                fns.push(createRemoveTask(badKeys[i]));
            }
            async.parallel(fns, function()
            {
                if (callback)
                {
                    callback();
                }
            })
        });
    };

    // invalidate any local cache entries containing a node by id. 
    // this method is registered as a callback from the invalidation handler
    var invalidateNode = r.invalidateNode = function(host, repositoryId, branchId, nodeId, callback)
    {
        subKeyMapCache().read("keyMapCache", function(err, keyMapCache){
            var keyMap =  {};
            var keyInverseMap = {};

            if (keyMapCache)
            {
                keyMap = keyMapCache.keyMapCache || {};
                keyInverseMap = keyMapCache.keyInverseMapCache || {};
            }

            if (keyMap[nodeId])
            {
                async.map(Object.keys(keyMap[nodeId]), function(key, callback){
                    remove(key, function(){
                        callback();
                    });
                }, function(err, result) {
                    delete keyMap[nodeId];

                    keyMapCache = {
                        "keyMapCache": keyMap,
                        "keyInverseMapCache": keyInverseMap
                    };

                    subKeyMapCache().write("keyMapCache", keyMapCache, function(){
                        callback();
                    });
                });
            }
            else
            {
                callback();
            }
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

        return util.createInterceptor("cache", function(req, res, next, stores, cache, configuration) {

            if (req.applicationId)
            {
                req.cache = createNamespacedCache.call(self, req.applicationId);
            }

            next();
        });
    };

    r.deploymentDescriptorCache = function()
    {
        return process.deploymentDescriptorCache;
    };

    r.driverConfigCache = function()
    {
        return process.driverConfigCache;
    };

    var subKeyMapCache = r.subKeyMapCache = function()
    {
        return process.subKeyMapCache;
    };

    return r;
}();
