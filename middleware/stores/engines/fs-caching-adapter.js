var path = require('path');
var http = require('http');

var fs = require("fs");

var util = require("../../../util/util");

var cluster = require("cluster");

/**
 * A caching wrapper around a store that provides local disk caching of assets to boost performance for serving assets
 * via a web server.  In a typical configuration, this is hooked up to Amazon S3 to provide cluster-wide caching of
 * resources.
 *
 * A 5 minute TTL is provided for any cached assets.
 *
 * This also optionally hooks into the process.broadcast service to notify other nodes in the cluster of cache
 * invalidation.
 *
 * @return {Function}
 */
exports = module.exports = function(remoteStore)
{
    var INVALIDATION_TOPIC = "fs-caching-adapter-path-invalidation";

    var TIMEOUT_MS = 5 * 60 * 1000;

    var tempDirectory = null;

    var notify = function(message, callback)
    {
        if (process.broadcast)
        {
            //console.log("[" + cluster.worker.id + "] Notifying: " + JSON.stringify(message));
            process.broadcast.publish(INVALIDATION_TOPIC, message);

            // TODO: is it possible to wait for broadcast to complete?
            if (callback) {
                callback();
            }
        }
        else
        {
            if (callback) {
                callback();
            }
        }
    };

    var bindSubscriptions = function()
    {
        if (process.broadcast)
        {
            process.broadcast.subscribe(INVALIDATION_TOPIC, function(message, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                var command = message.command;
                if ("invalidatePath" === command)
                {
                    console.log("FS CACHING invalidated path: " + message.path);

                    __internal_removeCachedObject(message.path);
                }

                invalidationDone();
            });
        }
    };

    var toCacheFilePath = function(filePath)
    {
        return path.join(tempDirectory, filePath + ".fscache");
    };

    var toCacheAssetPath = function(filePath)
    {
        return path.join(tempDirectory, filePath);
    };

    var _sendFile = function(res, filePath, cacheInfo, callback)
    {
        util.applyResponseContentType(res, cacheInfo, filePath);

        var options = {};

        res.sendFile(filePath, options, function (err) {

            if (err) {
                err.sendFailed = true;
            }

            callback(err);
        });
    };

    var _downloadFile = function(res, filePath, filename, cacheInfo, callback)
    {
        res.download(filePath, filename, function(err) {
            callback(err);
        });
    };

    var _writeFile = function(filePath, data, callback)
    {
        var fn = function(err)
        {
            fs.writeFile(filePath, data, function(err) {
                callback(err);
            });
        };

        var basedir = path.dirname(filePath);
        if (basedir) {
            util.createDirectory(basedir, function (err) {
                fn();
            });
        }
        else
        {
            fn();
        }
    };

    /**
     * Used to check the cache marker for each file or directory that gets written into the cache.
     * The cache marker is a JSON file which indicates:
     *
     *   {
     *      "faulted": whether the actual file is on disk or not
     *      "cached": whether this item is known in the cache
     *      "exists": whether this item exists
     *   }
     *
     * If the cache file exists, this means that a check was made previously to see if the asset was in the remote store.
     * If it was found in remote store, exists is true.  Otherwise, exists is false.
     *
     * If the cache file does not exist, this means that a check was never made.
     *
     * @param filePath
     * @param callback
     * @private
     */
    var __getCachedObjectState = function(filePath, callback)
    {
        var cacheFilePath = toCacheFilePath(filePath);
        var cacheAssetPath = toCacheAssetPath(filePath);

        fs.readFile(cacheFilePath, function(err, data) {

            var state = {};
            state.cached = false;
            state.faulted = false;
            state.exists = false;

            if (err) {
                callback(state);
                return;
            }

            if (!data || data.length === 0) {

                // cache file is invalid somehow
                __removeCachedObject(filePath, function() {
                    callback(state);
                });
                return;
            }

            var cacheFileJson = JSON.parse("" + data);

            state.cached = true;
            state.exists = false;

            fs.exists(cacheAssetPath, function(faulted) {

                state.faulted = faulted;

                // check timestamp (30 mins)
                var now = new Date().getTime();
                var timestamp = cacheFileJson.timestamp;
                if (now - timestamp > TIMEOUT_MS) {

                    // invalidate
                    __removeCachedObject(filePath);

                    state.faulted = false;
                }
                else
                {
                    state.exists = cacheFileJson.exists;
                }

                callback(state);
            });
        });
    };

    var __getCachedObjectData = function(filePath, callback)
    {
        __getCachedObjectState(filePath, function(state) {

            if (state.faulted)
            {
                var cacheAssetPath = toCacheAssetPath(filePath);

                fs.readFile(cacheAssetPath, function(err, data) {
                    callback(err, data);
                });
                return;
            }

            callback({
                "message": "Object is not in cache"
            });
        });
    };
    
    var __putCachedObject = function(filePath, exists, data, callback) {

        var cacheFilePath = toCacheFilePath(filePath);
        var cacheAssetPath = toCacheAssetPath(filePath);

        var finish = function()
        {
            if (data)
            {
                _writeFile(cacheAssetPath, data, function(err) {

                    if (err)
                    {
                        __removeCachedObjectAsset(filePath, function() {
                            if (callback)
                            {
                                callback(err);
                            }
                        });
                    }
                    else
                    {
                        if (callback)
                        {
                            callback(err);
                        }
                    }
                });
            }
            else
            {
                if (callback) {
                    callback();
                }
            }
        };

        if (typeof(exists) !== "undefined") {

            var state = {
                "exists": exists,
                "timestamp": new Date().getTime()
            };

            var stateAsString = JSON.stringify(state, null, "  ");
            _writeFile(cacheFilePath, stateAsString, function (err) {

                if (err)
                {
                    __removeCachedObject(filePath);
                    if (callback) {
                        callback(err);
                    }
                    return;
                }

                if (!exists)
                {
                    __removeCachedObjectAsset(filePath);
                    if (callback) {
                        callback(err);
                    }
                }
                else {
                    finish();
                }

            });
        }
        else
        {
            finish();
        }
    };

    var __removeCachedObject = function(filePath, callback)
    {
        __internal_removeCachedObject(filePath, function(err) {

            // broad cast
            notify({
                "command": "invalidatePath",
                "path": filePath
            });

            if (callback)
            {
                callback(err);
            }

        });
    };

    var __internal_removeCachedObject = function(filePath, callback)
    {
        var cacheFilePath = toCacheFilePath(filePath);
        var cacheAssetPath = toCacheAssetPath(filePath);

        fs.unlink(cacheFilePath, function (err) {
            fs.unlink(cacheAssetPath, function (err) {

                if (callback) {
                    callback();
                }
            });
        });
    };

    var __removeCachedObjectAsset = function(filePath, callback)
    {
        var cacheAssetPath = toCacheAssetPath(filePath);

        fs.unlink(cacheAssetPath, function (err) {
            if (callback) {
                callback();
            }
        });
    };

    var __moveCachedObject = function(oldFilePath, newFilePath, callback)
    {
        var oldCacheFilePath = toCacheFilePath(oldFilePath);
        var newCacheFilePath = toCacheFilePath(newFilePath);

        util.copyFile(oldCacheFilePath, newCacheFilePath);
        util.copyFile(oldFilePath, newFilePath);

        // remove old
        __removeCachedObject(oldFilePath, function() {
            callback();
        });
    };

    var r = {};

    var init = r.init = function(callback)
    {
        util.createTempDirectory(function(err, _tempDirectory) {
            tempDirectory = _tempDirectory;

            bindSubscriptions();

            callback();
        });
    };

    var allocated = r.allocated = function(basePath, callback)
    {
        existsDirectory(basePath, function(exists) {
            callback(exists)
        });
    };

    var existsFile = r.existsFile = function(filePath, callback)
    {
        __getCachedObjectState(filePath, function(state) {

            if (state.cached)
            {
                callback(state.exists);
                return;
            }

            // otherwise, go remote
            remoteStore.existsFile(filePath, function (exists) {
                __putCachedObject(filePath, exists, null, function(err) {
                    callback(exists);
                });
            });
        });
    };

    var existsDirectory = r.existsDirectory = function(directoryPath, callback)
    {
        __getCachedObjectState(directoryPath, function(state) {

            if (state.cached)
            {
                callback(state.exists);
                return;
            }

            // otherwise, go remote
            remoteStore.existsDirectory(directoryPath, function (exists) {
                __putCachedObject(directoryPath, exists, null, function(err) {
                    callback(exists);
                });
            });
        });
    };

    var removeFile = r.removeFile = function(filePath, callback)
    {
        remoteStore.removeFile(filePath, function(err) {

            // remove from cache
            __removeCachedObject(filePath, function() {
                callback(err);
            });
        });
    };

    var removeDirectory = r.removeDirectory = function(directoryPath, callback)
    {
        remoteStore.removeDirectory(directoryPath, function(err) {

            // remove from cache
            __removeCachedObject(directoryPath, function() {
                callback(err);
            });
        });
    };

    var listFiles = r.listFiles = function(directoryPath, callback)
    {
        remoteStore.listFiles(directoryPath, callback);
    };

    var sendFile = r.sendFile = function(res, filePath, cacheInfo, callback)
    {
        __getCachedObjectState(filePath, function(state) {

            var cacheAssetPath = toCacheAssetPath(filePath);

            if (state.faulted)
            {
                return _sendFile(res, cacheAssetPath, cacheInfo, callback);
            }

            // download to cache
            remoteStore.readStream(filePath, function(err, reader) {

                var writer = fs.createWriteStream(cacheAssetPath);
                writer.once("close", function() {
                    __putCachedObject(filePath, true, null, function() {
                        _sendFile(res, cacheAssetPath, cacheInfo, callback);
                    });
                });
                reader.pipe(writer);
            });
        });
    };

    r.downloadFile = function(res, filePath, filename, cacheInfo, callback)
    {
        __getCachedObjectState(filePath, function(state) {

            var cacheAssetPath = toCacheAssetPath(filePath);

            if (state.faulted)
            {
                return _downloadFile(res, cacheAssetPath, filename, cacheInfo, callback);
            }

            // download to cache
            remoteStore.readStream(filePath, function(err, reader) {
                var writer = fs.createWriteStream(cacheAssetPath);
                writer.once("close", function() {
                    __putCachedObject(filePath, true, null, function() {
                        _downloadFile(res, cacheAssetPath, filename, cacheInfo, callback);
                    });
                });
                reader.pipe(writer);
            });
        });
    };

    /*
    r.writeFile = function(filePath, data, callback)
    {
        remoteStore.writeFile(filePath, data, function(err) {

            // update cache
            if (err) {
                __removeCachedObject(filePath, function() {
                    callback(err);
                });
                return;
            }

            __putCachedObject(filePath, true, data, function() {
                callback(err);
            });
        });
    };
    */

    r.writeFile = function(filePath, data, callback)
    {
        __putCachedObject(filePath, true, data, function(err) {

            if (err)
            {
                callback(err);
                return;
            }

            // on a separate timeout, write to remote store
            setTimeout(function() {

                remoteStore.writeFile(filePath, data, function(err) {

                    if (err) {
                        console.log(err);
                    }

                });

            }, 1);

            callback();
        });

    };

    var readFile = r.readFile = function(filePath, callback)
    {
        var finish = function()
        {
            remoteStore.readFile(filePath, function(err, data) {

                // update cache
                if (!err) {
                    __putCachedObject(filePath, true, data, function() {
                        callback(err, data);
                    });
                    return;
                }

                callback(err, data)
            });
        };

        __getCachedObjectData(filePath, function(err, data) {

            if (err) {
                finish();
                return;
            }

            callback(null, data);
        });
    };

    r.watchDirectory = function(directoryPath, onChange)
    {
        // NOT IMPLEMENTED
    };

    r.moveFile = function(originalFilePath, newFilePath, callback)
    {
        remoteStore.moveFile(originalFilePath, newFilePath, function(err) {

            if (err) {
                callback(err);
                return;
            }

            // update cache
            __moveCachedObject(originalFilePath, newFilePath, function() {
                callback(err);
            });
        });
    };

    r.readStream = function(filePath, callback)
    {
        remoteStore.readStream(filePath, callback);
    };

    r.writeStream = function(filePath, callback)
    {
        remoteStore.writeStream(filePath, callback);
    };

    var fileStats = r.fileStats = function(filePath, callback)
    {
        remoteStore.fileStats(filePath, function(err, stats) {
            callback(err, stats);
        });
    };

    var matchFiles = r.matchFiles = function(directoryPath, regexPattern, callback)
    {
        remoteStore.matchFiles(directoryPath, regexPattern, function(err, filenames) {
            callback(null, filenames);
        });
    };

    return r;
};

