var path = require('path');
var fs = require('fs');
var http = require('http');

var mime = require("mime");
var mkdirp = require("mkdirp");

var util = require("../../../util/util");

var watch = require("watch");

/**
 * A simple store based around the node file system.
 *
 * @return {Function}
 */
exports = module.exports = function(engineId, engineType, engineConfig)
{
    var r = {};

    var _createDirectory = function(directoryPath, callback)
    {
        mkdirp(directoryPath, function(err) {

            if (err) {
                callback(err);
                return;
            }

            // safety check to ensure exists
            existsFile(directoryPath, function(exists) {

                if (!exists) {
                    callback({
                        "message": "Could not create directory path: " + directoryPath
                    });
                    return;
                }

                callback(null, directoryPath);
            });
        });
    };

    var init = r.init = function(callback)
    {
        callback();
    };

    var allocated = r.allocated = function(basePath, callback)
    {
        existsFile(basePath, function(exists) {
            callback(exists)
        });
    };

    var existsFile = r.existsFile = function(filePath, callback) {
        fs.exists(filePath, function(exists) {
            callback(exists);
        });
    };

    var existsDirectory = r.existsDirectory = function(directoryPath, callback)
    {
        return existsFile(directoryPath, callback);
    };

    var removeFile = r.removeFile = function(filePath, callback)
    {
        if (!filePath || filePath === "/")
        {
            console.log("ILLEGAL PATH");
            return;
        }

        fs.unlink(filePath, function(err) {
            callback(err);
        });
    };

    var removeDirectory = r.removeDirectory = function(directoryPath, callback)
    {
        if (!directoryPath || directoryPath === "/")
        {
            console.log("ILLEGAL PATH");
            return;
        }

        // synchronous remove
        util.rmdir(directoryPath);

        callback();
    };

    var listFiles = r.listFiles = function(directoryPath, callback)
    {
        existsFile(directoryPath, function(exists) {

            if (!exists) {
                callback(null, []);
                return;
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
                callback({
                    "doesNotExist": true
                });
                return;
            }
            else
            {
                fileStats(filePath, function(err, stats) {

                    if (err) {
                        err.doesNotExist = true;
                        callback(err);
                        return;
                    }

                    if (!stats) {
                        err.doesNotExist = true;
                        callback(err);
                        return;
                    }

                    if (stats.size === 0) {
                        var err = {
                            "message": "Stats was size zero for file: " + filePath,
                            "zeroSize": true
                        };
                        callback(err);
                        return;
                    }

                    // read the file
                    readFile(filePath, function (err, data) {

                        if (err) {
                            err.readFailed = true;
                            callback(err);
                            return;
                        }

                        util.applyResponseContentType(res, cacheInfo, filePath);

                        var options = {};

                        res.sendFile(filePath, options, function (err) {

                            if (err) {
                                err.sendFailed = true;
                                callback(err);
                                return;
                            }
                        });

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
            _createDirectory(basedir, function(err) {

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

            if (err) {
                // not found
                callback({
                    "message": "File not found: " + filePath
                });
                return;
            }

            if (!stats)
            {
                callback({
                    "message": "File does not have stats"
                });
                return;
            }

            if (stats.size === 0)
            {
                callback({
                    "message": "File was size 0"
                });
                return;
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
            _createDirectory(basedir, function(err) {

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

    var fileStats = r.fileStats = function(filePath, callback)
    {
        fs.exists(filePath, function(exists) {

            if (!exists) {
                callback({
                    "message": "File does not exist for path: " + filePath
                });
                return;
            }

            fs.stat(filePath, function(err, fileStats) {

                var stats = {};
                stats.directory = fileStats.isDirectory();
                stats.file = fileStats.isFile();
                stats.size = fileStats.size;

                callback(err, stats);
            });

        })
    };

    return r;
};

