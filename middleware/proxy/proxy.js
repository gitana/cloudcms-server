var path = require('path');
// var fs = require('fs');
// var http = require('http');
// var https = require('https');

// var httpProxy = require('http-proxy');

// var oauth2 = require("../../util/oauth2")();

// var async = require("async");

var util = require("../../util/util");
// var auth = require("../../util/auth");

var proxyFactory = require("../../util/proxy-factory");

/**
 * Proxy middleware.
 *
 * Supports TTL caching based on paths for anything that comes through the proxy.
 *
 * Example:
 *
 * {
 *    "proxy": {
 *       "enabled": true,
 *       "cache": [{
 *          "path": "/repositories/.*",
 *          "seconds": 60
 *       }
 *    }
 * }
 */
exports = module.exports = function()
{
    var _cacheTTL = function(req)
    {
        var ttl = 0;

        if (process.env.CLOUDCMS_APPSERVER_MODE === "production") {
            if (process.configuration && process.configuration.proxy) {
                if (process.configuration.proxy.enabled) {
                    if (process.configuration.proxy.cache) {
                        var elements = process.configuration.proxy.cache;
                        if (elements) {
                            for (var i = 0; i < elements.length; i++) {
                                if (elements[i].path) {
                                    var regex = new RegExp(elements[i].path);
                                    if (regex.test(req.path)) {
                                        var seconds = elements[i].seconds;
                                        if (seconds >= 0) {
                                            ttl = seconds * 1000;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return ttl;
    };

    var _handleCacheRead = function(req, callback)
    {
        var cacheTTL = _cacheTTL(req);
        if (cacheTTL <= 0)
        {
            return callback();
        }

        var contentStore = req.stores.content;
        if (!contentStore)
        {
            return callback(false);
        }

        var filePath = path.join("proxy", req.path);

        contentStore.existsFile(filePath, function(exists) {

            if (!exists) {
                callback();
                return;
            }

            contentStore.fileStats(filePath, function(err, stats) {

                if (err) {
                    callback();
                    return;
                }

                if (stats.size == 0) {
                    callback();
                    return;
                }

                var handleGoodStream = function()
                {
                    contentStore.readStream(filePath, function (err, readStream) {
                        callback(err, readStream);
                    });
                };

                var handleBadStream = function()
                {
                    contentStore.removeFile(filePath, function() {
                        contentStore.removeFile(filePath + ".cache", function() {
                            callback();
                        });
                    });
                };

                // check cacheInfo for expireTime
                contentStore.readFile(filePath + ".cache", function(err, cacheInfoText) {

                    if (err || !cacheInfoText)
                    {
                        return handleBadStream();
                    }

                    var cacheInfo = JSON.parse(cacheInfoText);
                    var expireTime = cacheInfo.expireTime;
                    if (new Date().getTime() > expireTime)
                    {
                        handleBadStream();
                    }
                    else
                    {
                        handleGoodStream();
                    }

                });
            });
        });
    };

    var _handleInvalidate = function(host, cachedPath, callback)
    {
        var stores = require("../stores/stores");
        stores.produce(host, function (err, stores) {

            if (err) {
                return callback(err);
            }

            var filePath = path.join("proxy", cachedPath);

            var contentStore = stores.content;

            contentStore.existsFile(filePath, function(exists) {

                if (!exists) {
                    return callback();
                }

                contentStore.removeFile(filePath, function() {
                    contentStore.removeFile(filePath + ".cache", function() {
                        callback();
                    });
                });
            });

        });
    };

    var _handleWrapCacheWriter = function(req, res, callback)
    {
        var cacheTTL = _cacheTTL(req);
        if (cacheTTL <= 0)
        {
            return callback();
        }

        var contentStore = req.stores.content;
        if (!contentStore)
        {
            return callback(false);
        }

        var filePath = path.join("proxy", req.path);

        contentStore.writeStream(filePath, function(err, writeStream) {

            // wrap response with a piping mechanism that caches down to disk

            // original methods
            var _write = res.write;
            var _end = res.end;

            // wrap write() method
            res.write = function(data, encoding) {

                if (writeStream) {
                    writeStream.write(data, encoding);
                }

                _write.call(res, data, encoding);
            };

            // wrap end() method
            res.end = function(data, encoding) {

                if (writeStream) {
                    writeStream.end();
                }

                // write a cache info file as well
                var cacheInfo = {
                    "expireTime": new Date().getTime() + cacheTTL
                };
                contentStore.writeFile(filePath + ".cache", JSON.stringify(cacheInfo), function() {
                    _end.call(res, data, encoding);
                });
``            };

            callback();
        });
    };

    var r = {};

    r.proxy = function() {

        // bind listeners for broadcast events
        bindSubscriptions.call(this);

        return util.createHandler("proxy", function(req, res, next, stores, cache, configuration) {

            if (req.url.indexOf("/proxy") === 0)
            {
                req.url = req.url.substring(6); // to strip off /proxy
                if (req.url === "")
                {
                    req.url = "/";
                }

                // caching scenario
                _handleCacheRead(req, function (err, readStream) {

                    if (!err && readStream)
                    {
                        return util.sendFile(res, readStream, function (err) {
                            // done!
                        });
                    }

                    _handleWrapCacheWriter(req, res, function(err) {

                        // acquire the proxy handler
                        var proxyTarget = req.gitanaConfig.baseURL;
                        if (!proxyTarget) {
                            return next({
                                "message": "Missing baseURL from request bound gitana-config"
                            });
                        }
                        proxyFactory.acquireProxyHandler(proxyTarget, null, function(err, proxyHandler) {
                            if (err) {
                                return next(err);
                            }

                            proxyHandler(req, res);
                        });
                    });
                });
            }
            else
            {
                next();
            }
        });
    };

    var bound = false;
    var bindSubscriptions = function()
    {
        var self = this;

        if (process.broadcast && !bound)
        {
            process.broadcast.subscribe("node_invalidation", function (message, channel, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                var repositoryId = message.repositoryId;
                var branchId = message.branchId;
                var nodeId = message.nodeId;

                var host = message.host;

                var path = "/repositories/" + repositoryId + "/branches/" + branchId + "/nodes/" + nodeId;

                _handleInvalidate(host, path, function(err) {
                    invalidationDone(err);
                });

            });

            bound = true;
        }
    };

    return r;
}();
