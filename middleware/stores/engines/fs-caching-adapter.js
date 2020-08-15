var path = require('path');
var async = require('async');

var fs = require("fs");

var util = require("../../../util/util");

/**
 * A caching wrapper around a remote store that locally caches assets to provide faster servicing of assets for
 * use in a web server.  In a typical configuration, the remote store might be something like Amazon S3.
 *
 * Upon startup, the caching adapter pulls down a local disk-cached copy of all assets.  The local disk cache
 * is then used to service all subsequent calls.
 *
 * When mutating changes are made (such as a writeFile or removeFile call), the contents are deleted from the
 * disk cache as well as the remote store.  A notification message is then raised to signal any other cluster
 * members to invalidate their cache as well (with the options.cacheOnly) flag set high so that the remote asset
 * is not mutated a second time.
 *
 * Assets that are cached to local disk are cached without a TTL.  They do not invalidate on their own.  The only
 * mutation that may occur is via the store itself.  Direct changes to the remote store (such as direct changes to
 * S3 contents) are not supported.  All changes must route through this interface.
 *
 * @return {Function}
 */
exports = module.exports = function(remoteStore, settings)
{
    var INVALIDATION_TOPIC = "fs-caching-adapter-path-invalidation";

    if (!settings) {
        settings = {};
    }

    var cacheStore = null;

    var notifyInvalidation = function(message, callback)
    {
        if (!callback) {
            callback = function() { };
        }

        if (!process.broadcast)
        {
            return callback();
        }

        console.log("Notifying: " + JSON.stringify(message));

        //console.log("[" + cluster.worker.id + "] Notifying: " + JSON.stringify(message));
        process.broadcast.publish(INVALIDATION_TOPIC, message, function() {
            callback();
        });
    };

    var _bindSubscriptions = function()
    {
        if (process.broadcast)
        {
            process.broadcast.subscribe(INVALIDATION_TOPIC, function(message, channel, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                console.log("Heard notification: " + JSON.stringify(message));

                var fns = [];

                if (message.paths)
                {
                    for (var i = 0; i < message.paths.length; i++)
                    {
                        var fn = function(filepath)
                        {
                            return function(done)
                            {
                                _invalidateCache(filepath, function(err) {
                                    done(err);
                                });
                            }
                        }(message.paths[i]);
                        fns.push(fn);
                    }
                }

                async.series(fns, function() {
                    invalidationDone();
                });
            });
        }
    };

    var _invalidateCache = function(filepath, callback)
    {
        console.log("Invalidating cache for file path:" + filepath);

        cacheStore.removeDirectory(filepath, function() {
            cacheStore.removeFile(filepath, function() {

                // read stream
                remoteStore.readStream(filepath, function(err, reader) {

                    if (err) {
                        return callback();
                    }

                    // write stream
                    cacheStore.writeStream(filepath, function(err, writer) {

                        if (err) {
                            return callback(err);
                        }

                        // pipe through
                        reader.pipe(writer).on("close", function (err) {
                            callback(err);
                        });
                    });
                });
            });
        });
    };

    var _populateCache = function(callback)
    {
        try
        {
            remoteStore.listFiles("/", { "recursive": true }, function(err, filepaths) {

                console.log("Populating cache with file paths:" + JSON.stringify(filepaths, null, 2));

                var fns = [];

                for (var i = 0; i < filepaths.length; i++)
                {
                    var fn = function(remoteStore, cacheStore, filepath) {
                        return function(done) {

                            console.log("Populating cache: "+ filepath);

                            // read stream
                            remoteStore.readStream(filepath, function(err, reader) {

                                if (err) {
                                    console.log("err on remoteStore.readStream: " + filepath);
                                    console.log(err);
                                }

                                // write stream
                                cacheStore.writeStream(filepath, function(err, writer) {

                                    if (err) {
                                        console.log("err on cacheStore.writeStream: " + filepath);
                                        console.log(err);
                                    }

                                    // pipe through
                                    reader.pipe(writer).on("close", function (err) {
                                        done(err);
                                    });
                                });
                            });
                        }
                    }(remoteStore, cacheStore, filepaths[i]);
                    fns.push(fn);
                }

                async.parallelLimit(fns, 4, function(err) {
                    callback(err);
                });
            });
        }
        catch (e)
        {
            return callback();
        }
    };

    var r = {};

    var init = r.init = function(callback)
    {
        var completionFn = function()
        {
            console.log("using cacheDir: " + settings.cacheDir);

            // build cach store on top of this temp directorys
            cacheStore = require("./fs")({
                "storageDir": settings.cacheDir
            });

            // preload the cache
            _populateCache(function(err) {

                _bindSubscriptions();

                callback(err);
            });
        };

        if (settings.cacheDir)
        {
            return completionFn();
        }

        // create a temp directory for the cache
        return util.createTempDirectory(function(err, _tempDirectory) {
            settings.cacheDir = _tempDirectory;

            completionFn();
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
        cacheStore.existsFile(filePath, callback);
    };

    var existsDirectory = r.existsDirectory = function(directoryPath, callback)
    {
        cacheStore.existsDirectory(directoryPath, callback);
    };

    var removeFile = r.removeFile = function(filePath, options, callback)
    {
        if (typeof(options) === "function") {
            callback = options;
            options = null;
        }

        var fns = [];

        if (!options.cacheOnly)
        {
            fns.push(function(remoteStore, cacheStore, filePath, options) {
                return function(done) {
                    remoteStore.removeFile(filePath, options, function(err) {
                        done(err);
                    });
                }
            });
        }

        fns.push(function(remoteStore, cacheStore, filePath, options) {
            return function(done) {
                cacheStore.removeFile(filePath, options, function() {
                    done();
                });
            }
        });

        async.series(fns, function(err) {

            notifyInvalidation({
                "paths": [filePath]
            }, function() {
                callback(err);
            });

        });
    };

    var removeDirectory = r.removeDirectory = function(directoryPath, options, callback)
    {
        if (typeof(options) === "function") {
            callback = options;
            options = null;
        }

        var fns = [];

        if (!options.cacheOnly)
        {
            fns.push(function(remoteStore, cacheStore, directoryPath, options) {
                return function(done) {
                    remoteStore.removeDirectory(directoryPath, options, function(err) {
                        done(err);
                    });
                }
            });
        }

        fns.push(function(remoteStore, cacheStore, directoryPath, options) {
            return function(done) {
                cacheStore.removeDirectory(directoryPath, options, function() {
                    done();
                });
            }
        });

        async.series(fns, function(err) {

            notifyInvalidation({
                "paths": [directoryPath]
            }, function() {
                callback(err);
            });

        });
    };

    var listFiles = r.listFiles = function(directoryPath, options, callback)
    {
        if (!options) {
            options = {};
        }

        cacheStore.listFiles(directoryPath, options, callback);
    };

    var sendFile = r.sendFile = function(res, filePath, cacheInfo, callback)
    {
        util.applyResponseContentType(res, cacheInfo, filePath);

        cacheStore.readStream(filePath, function(err, reader) {
            reader.pipe(res).on("close", function(err) {

                if (err) {
                    err.sendFailed = true;
                }

                callback(err);
            });
        });
    };

    r.downloadFile = function(res, filePath, filename, cacheInfo, callback)
    {
        var contentDisposition = "attachment";
        if (filename)
        {
            // if filename contains non-ascii characters, add a utf-8 version ala RFC 5987
            contentDisposition = /[^\040-\176]/.test(filename)
                ? 'attachment; filename="' + encodeURI(filename) + '"; filename*=UTF-8\'\'' + encodeURI(filename)
                : 'attachment; filename="' + filename + '"';
        }

        // set Content-Disposition when file is sent
        util.setHeader(res, "Content-Disposition", contentDisposition);

        sendFile(res, filePath, cacheInfo, callback);
    };

    r.writeFile = function(filePath, data, callback)
    {
        cacheStore.write(filePath, data, function(err) {

            remoteStore.writeFile(filePath, data, function(err) {

                if (err)
                {
                    return cacheStore.removeFile(filePath, function() {
                        callback(err);
                    });
                }

                notifyInvalidation({
                    "paths": [filePath]
                }, function() {
                    callback(err);
                });

                callback();
            });
        });
    };

    var readFile = r.readFile = function(filePath, callback)
    {
        cacheStore.readFile(filePath, callback);
    };

    r.watchDirectory = function(directoryPath, onChange)
    {
        // NOT IMPLEMENTED
    };

    r.moveFile = function(originalFilePath, newFilePath, callback)
    {
        remoteStore.moveFile(originalFilePath, newFilePath, function(err) {

            if (err) {
                return callback(err);
            }

            cacheStore.moveFile(originalFilePath, newFilePath, function () {

                notifyInvalidation({
                    "paths": [originalFilePath, newFilePath]
                }, function() {
                    callback(err);
                });

            });
        });
    };

    r.readStream = function(filePath, callback)
    {
        cacheStore.readStream(filePath, callback);
    };

    r.writeStream = function(filePath, callback)
    {
        cacheStore.writeStream(filePath, function(err) {

            notifyInvalidation({
                "paths": [filePath]
            }, function() {
                callback(err);
            });

        });
    };

    var fileStats = r.fileStats = function(filePath, callback)
    {
        cacheStore.fileStats(filePath, function(err, stats) {
            callback(err, stats);
        });
    };

    var matchFiles = r.matchFiles = function(directoryPath, regexPattern, callback)
    {
        cacheStore.matchFiles(directoryPath, regexPattern, function(err, filenames) {
            callback(null, filenames);
        });
    };

    return r;
};

