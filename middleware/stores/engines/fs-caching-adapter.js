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
    var log = function(text)
    {
        console.log("[fs-caching-adapter] " + text);
    };

    var INVALIDATION_TOPIC = "fs-caching-adapter-path-invalidation-" + remoteStore.id;

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

        log("Notifying: " + JSON.stringify(message));

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

                log("Heard notification: " + JSON.stringify(message));

                var fns = [];

                if (message.files)
                {
                    for (var i = 0; i < message.files.length; i++)
                    {
                        var fn = function(filePath)
                        {
                            return function(done)
                            {
                                _invalidateCache(filePath, false, function(err) {
                                    done(err);
                                });
                            }
                        }(message.files[i]);
                        fns.push(fn);
                    }
                }

                if (message.directories)
                {
                    for (var i = 0; i < message.directories.length; i++)
                    {
                        var fn = function(directoryPath)
                        {
                            return function(done)
                            {
                                _invalidateCache(directoryPath, true, function(err) {
                                    done(err);
                                });
                            }
                        }(message.directories[i]);
                        fns.push(fn);
                    }
                }

                async.series(fns, function() {
                    invalidationDone();
                });
            });
        }
    };

    var _invalidateCache = function(filepath, isDirectory, callback)
    {
        log("Invalidating cache for file path:" + filepath);

        var fns = [];

        if (isDirectory)
        {
            fns.push(function(cacheStore, filepath) {
                return function(done) {
                    cacheStore.removeDirectory(filepath, function() {
                        done();
                    });
                }
            }(cacheStore, filepath));
        }
        else
        {
            fns.push(function(cacheStore, filepath) {
                return function(done) {

                    // remove file
                    cacheStore.removeFile(filepath, function() {

                        // try to copy new file down (if it exists)

                        // read stream
                        remoteStore.readStream(filepath, function(err, reader) {

                            if (err) {
                                // does not exist
                                return done();
                            }

                            // write stream
                            cacheStore.writeStream(filepath, function(err, writer) {

                                if (err) {
                                    return done(err);
                                }

                                // pipe through
                                reader.pipe(writer).on("close", function (err) {
                                    done(err);
                                });
                            });
                        });

                    });
                }
            }(cacheStore, filepath));
        }

        async.series(fns, function(err) {
            callback(err);
        })
    };

    var _populateCache = function(callback)
    {
        try
        {
            remoteStore.listFiles("/", { "recursive": true }, function(err, filepaths) {

                log("Populating cache with file paths:" + JSON.stringify(filepaths, null, 2));

                var fns = [];

                for (var i = 0; i < filepaths.length; i++)
                {
                    var fn = function(remoteStore, cacheStore, filepath) {
                        return function(done) {

                            log("Populating cache: "+ filepath);

                            // read stream
                            remoteStore.readStream(filepath, function(err, reader) {

                                if (err) {
                                    log("err on remoteStore.readStream: " + filepath);
                                    log(JSON.stringify(err, null, 2));
                                    return done();
                                }

                                // write stream
                                cacheStore.writeStream(filepath, function(err, writer) {

                                    if (err) {
                                        log("err on cacheStore.writeStream: " + filepath);
                                        log(JSON.stringify(err, null, 2));
                                        return done();
                                    }

                                    // pipe through
                                    reader.pipe(writer).once("close", function (err) {
                                        done(err);
                                    });
                                });
                            });
                        }
                    }(remoteStore, cacheStore, filepaths[i]);
                    fns.push(fn);
                }

                async.series(fns, function(err) {
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
            log("Store init, using cacheDir: " + settings.cacheDir);

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
            }(remoteStore, cacheStore, filePath, options));
        }

        fns.push(function(remoteStore, cacheStore, filePath, options) {
            return function(done) {
                cacheStore.removeFile(filePath, options, function() {
                    done();
                });
            }
        }(remoteStore, cacheStore, filePath, options));

        async.series(fns, function(err) {

            notifyInvalidation({
                "files": [filePath]
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
            }(remoteStore, cacheStore, directoryPath, options));
        }

        fns.push(function(remoteStore, cacheStore, directoryPath, options) {
            return function(done) {
                cacheStore.removeDirectory(directoryPath, options, function() {
                    done();
                });
            }
        }(remoteStore, cacheStore, directoryPath, options));

        async.series(fns, function(err) {

            notifyInvalidation({
                "directories": [directoryPath]
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
        cacheStore.writeFile(filePath, data, function(err) {

            remoteStore.writeFile(filePath, data, function(err) {

                if (err)
                {
                    return cacheStore.removeFile(filePath, function() {
                        callback(err);
                    });
                }

                notifyInvalidation({
                    "files": [filePath]
                }, function() {
                    callback(err);
                });
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
                    "files": [originalFilePath, newFilePath]
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
                "files": [filePath]
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

