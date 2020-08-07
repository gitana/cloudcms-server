var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../../../util/util");

var watch = require("watch");

var async = require("async");

/**
 * A simple store based around the node file system.
 *
 * @return {Function}
 */
exports = module.exports = function(engineConfig)
{
    var r = {};

    var init = r.init = function(callback)
    {
        callback();
    };

    var allocated = r.allocated = function(basePath, callback)
    {
        existsDirectory(basePath, function(exists) {
            callback(exists)
        });
    };

    var existsFile = r.existsFile = function(filePath, callback)
    {
        fs.exists(filePath, function(exists) {
            callback(exists);
        });
    };

    var existsDirectory = r.existsDirectory = function(directoryPath, callback)
    {
        return existsFile(directoryPath, callback);
    };

    var removeFile = r.removeFile = function(filePath, options, callback)
    {
        if (typeof(options) === "function") {
            callback = options;
            options = null;
        }

        if (!filePath || filePath === "/")
        {
            console.log("ILLEGAL PATH");
            return callback();
        }

        fs.unlink(filePath, function(err) {
            callback(err);
        });
    };

    var removeDirectory = r.removeDirectory = function(directoryPath, options, callback)
    {
        if (typeof(options) === "function") {
            callback = options;
            options = null;
        }

        if (!directoryPath || directoryPath === "/")
        {
            console.log("ILLEGAL PATH");
            return callback();
        }

        // synchronous remove
        util.rmdir(directoryPath);

        callback();
    };

    var listFiles = r.listFiles = function(directoryPath, callback)
    {
        existsFile(directoryPath, function(exists) {

            if (!exists) {
                return callback(null, []);
            }

            fs.readdir(directoryPath, function(err, filenames) {
                callback(err, filenames);
            });
        });
    };

    var sendFile = r.sendFile = function(res, filePath, cacheInfo, callback)
    {
        existsFile(filePath, function(exists) {

            if (!exists)
            {
                return callback({
                    "doesNotExist": true
                });
            }
            else
            {
                fileStats(filePath, function(err, stats) {

                    if (err) {
                        err.doesNotExist = true;
                        return callback(err);
                    }

                    if (!stats) {
                        err.doesNotExist = true;
                        return callback(err);
                    }

                    util.applyResponseContentType(res, cacheInfo, filePath);

                    var options = {};

                    res.sendFile(filePath, options, function (err) {

                        if (err) {
                            err.sendFailed = true;
                        }

                        callback(err);
                    });
                });
            }
        });
    };

    r.downloadFile = function(res, filePath, filename, cacheInfo, callback)
    {
        res.download(filePath, filename, function(err) {
            callback(err);
        });
    };

    r.writeFile = function(filePath, data, callback)
    {
        var finish = function()
        {
            fs.writeFile(filePath, data, function(err) {
                callback(err);
            });
        };

        var basedir = path.dirname(filePath);
        if (basedir)
        {
            util.createDirectory(basedir, function(err) {

                if (err) {
                    callback(err);
                    return;
                }

                finish();
            });
        }
        else
        {
            finish();
        }
    };

    var readFile = r.readFile = function(filePath, callback)
    {
        fileStats(filePath, function(err, stats) {

            if (err)
            {
                // not found
                return callback({
                    "message": "File not found: " + filePath
                });
            }

            if (!stats)
            {
                return callback({
                    "message": "File does not have stats"
                });
            }

            if (stats.size === 0)
            {
                return callback({
                    "message": "File was size 0"
                });
            }

            fs.readFile(filePath, function(err, data) {
                callback(err, data);
            });

        });
    };

    r.watchDirectory = function(directoryPath, onChange)
    {
        watch.watchTree(directoryPath, function(f, curr, prev) {
            onChange(f, curr, prev);
        });
    };

    r.moveFile = function(originalFilePath, newFilePath, callback)
    {
        fs.rename(originalFilePath, newFilePath, function(err) {
            callback(err);
        });
    };

    r.readStream = function(filePath, callback)
    {
        var s = fs.ReadStream(filePath);

        callback(null, s);
    };

    r.writeStream = function(filePath, callback)
    {
        var finish = function()
        {
            var s = fs.createWriteStream(filePath);

            callback(null, s);
        };

        var basedir = path.dirname(filePath);
        if (basedir)
        {
            util.createDirectory(basedir, function(err) {

                if (err) {
                    return callback(err);
                }

                finish();
            });
        }
        else
        {
            finish();
        }
    };

    var fileStats = r.fileStats = function(filePath, callback)
    {
        fs.exists(filePath, function(exists) {

            if (!exists) {
                return callback({
                    "message": "File does not exist for path: " + filePath
                });
            }

            fs.stat(filePath, function(err, fileStats) {

                if (err) {
                    return callback(err);
                }

                if (!fileStats) {
                    return callback({
                        "message": "Unable to produce file stats for path: " + filePath
                    });
                }

                var stats = {};
                stats.directory = fileStats.isDirectory();
                stats.file = fileStats.isFile();
                stats.size = fileStats.size;
                stats.mtimeMs = fileStats.mtimeMs || -1;

                callback(err, stats);
            });

        })
    };

    r.matchFiles = function(directoryPath, regexPattern, callback)
    {
        var assembleMatches = function(candidatePath, regex, matches, finish)
        {
            if (regex.test(candidatePath))
            {
                matches.push(candidatePath);
            }

            fs.readdir(path.join(directoryPath, candidatePath), function(err, filenames) {

                // if not a directory, we are done
                if (err) {
                    return finish(null);
                }

                // sub-functions
                var fns = [];
                for (var i = 0; i < filenames.length; i++)
                {
                    var filePath = path.join(candidatePath, filenames[i]);

                    var fn = function(filePath, regex, matches) {
                        return function(done) {
                            assembleMatches(filePath, regex, matches, function(err) {
                                done(err);
                            });
                        };
                    }(filePath, regex, matches);
                    fns.push(fn);
                }

                async.series(fns, function(err) {
                    finish(err);
                });
            });
        };

        var regex = new RegExp(regexPattern);
        var matches = [];

        assembleMatches("/", regex, matches, function(err) {
            callback(err, matches);
        });

    };

    return r;
};

