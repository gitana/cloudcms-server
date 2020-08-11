var request = require('request');
var path = require('path');

var util = require("../../util/util");

var stores = require("./stores");

/**
 * Helper methods for working with domains, identities and connections.
 *
 * @return {Function}
 */
exports = module.exports = function(engine, engineType, engineId, engineConfiguration, host, offsetPath)
{
    var DEBUG_LOG = false;
    /*
    var debugLog = function(text) {
        if (DEBUG_LOG) {
            console.log(text);
        }
    };
    */
    var t1 = null;
    var t2 = null;
    var debugStart = function(text) {
        if (DEBUG_LOG) {
            console.log(text);
            t1 = new Date().getTime();
        }
    };
    var debugFinish = function(text) {
        if (DEBUG_LOG) {
            t2 = new Date().getTime();
            console.log(text + ": " + (t2-t1) + " ms");
        }
    };

    var hostsPath = function()
    {
        var hostsPath = engineConfiguration.hostsPath;
        if (!hostsPath)
        {
            hostsPath = "./";
        }

        // substitutions
        hostsPath = util.replaceAll(hostsPath, "{appBasePath}", process.env.CLOUDCMS_APPSERVER_BASE_PATH);
        hostsPath = util.replaceAll(hostsPath, "{tmpdirPath}", process.env.CLOUDCMS_TEMPDIR_PATH);

        return hostsPath;
    };

    var basePath = function()
    {
        var basePath = engineConfiguration.basePath;
        if (!basePath)
        {
            basePath = "./";
        }

        // substitutions
        basePath = util.replaceAll(basePath, "{host}", host);
        basePath = util.replaceAll(basePath, "{appBasePath}", process.env.CLOUDCMS_APPSERVER_BASE_PATH);
        basePath = util.replaceAll(basePath, "{tmpdirPath}", process.env.CLOUDCMS_TEMPDIR_PATH);

        if (offsetPath) {
            basePath = path.join(basePath, offsetPath);
        }

        return basePath;
    };

    var _enginePath = function(relativePath)
    {
        return path.join(basePath(), relativePath);
    };

    var r = {};

    r.id = engineType + "://" + engineId + basePath();

    //////////////////////////////////////////////////

    r.allocated = function(callback)
    {
        debugStart("Start store.allocated");
        engine.allocated(_enginePath("/"), function(allocated) {
            debugFinish("Finish store.allocated");
            callback(allocated);
        });
    };

    r.cleanup = function(subpath, options, callback)
    {
        if (typeof(subpath) === "function")
        {
            callback = subpath;
            subpath = "/";
        }

        if (typeof(options) === "function")
        {
            callback = options;
            options = null;
        }

        debugStart("Start store.cleanup");
        engine.removeDirectory(_enginePath(subpath), options, function(err) {
            debugFinish("Finish store.cleanup");
            callback(err);
        });
    };

    r.supportsHosts = function()
    {
        return engineConfiguration.hostsPath;
    };

    r.listHosts = function(callback)
    {
        debugStart("Start store.listHosts");
        engine.listFiles(hostsPath(), function(err, hostnames) {
            debugFinish("Finish store.listHosts");
            callback(err, hostnames);
        });
    };

    //////////////////////////////////////////////////

    r.existsFile = function(filePath, callback)
    {
        debugStart("Start store.existsFile");
        engine.existsFile(_enginePath(filePath), function(exists) {
            debugFinish("Finish store.existsFile");
            callback(exists);
        });
    };

    r.existsDirectory = function(directoryPath, callback)
    {
        debugStart("Start store.existsDirectory");
        engine.existsDirectory(_enginePath(directoryPath), function(exists) {
            debugFinish("Finish store.existsDirectory");
            callback(exists);
        });
    };

    r.removeFile = r.deleteFile = function(filePath, options, callback)
    {
        debugStart("Start store.deleteFile");
        engine.removeFile(_enginePath(filePath), options, function(err) {
            debugFinish("Finish store.deleteFile");
            callback(err);
        });
    };

    r.removeDirectory = r.deleteDirectory = function(directoryPath, options, callback)
    {
        debugStart("Start store.deleteDirectory");
        engine.removeDirectory(_enginePath(directoryPath), options, function(err) {
            debugFinish("Finish store.deleteDirectory");
            callback(err);
        });
    };

    r.listFiles = function(directoryPath, callback)
    {
        debugStart("Start store.listFiles");
        engine.listFiles(_enginePath(directoryPath), function(err, filenames) {
            debugFinish("Finish store.listFiles");
            callback(err, filenames);
        });
    };

    r.sendFile = function(res, filePath, cacheInfo, callback)
    {
        if (typeof(cacheInfo) === "function")
        {
            callback = cacheInfo;
            cacheInfo = null;
        }

        debugStart("Start store.sendFile");
        engine.sendFile(res, _enginePath(filePath), cacheInfo, function(err) {
            debugFinish("Finish store.sendFile");
            if (callback) {
                callback(err);
            }
        });
    };

    r.downloadFile = function(res, filePath, filename, cacheInfo, callback)
    {
        if (typeof(cacheInfo) === "function")
        {
            callback = cacheInfo;
            cacheInfo = null;
        }

        debugStart("Start store.downloadFile");
        engine.downloadFile(res, _enginePath(filePath), filename, cacheInfo, function(err) {
            debugFinish("Finish store.downloadFile");
            callback(err);
        });
    };

    r.writeFile = function(filePath, data, callback)
    {
        debugStart("Start store.writeFile");
        engine.writeFile(_enginePath(filePath), data, function(err) {
            debugFinish("Finish store.writeFile");
            callback(err);
        });
    };

    r.readFile = function(path, callback)
    {
        debugStart("Start store.readFile");
        engine.readFile(_enginePath(path), function(err, data) {
            debugFinish("Finish store.readFile");
            callback(err, data);
        });
    };

    r.watchDirectory = function(directoryPath, onChange)
    {
        debugStart("Start store.watchDirectory: " + _enginePath(directoryPath));
        engine.watchDirectory(_enginePath(directoryPath), function(f, curr, prev) {
            debugFinish("Finish store.watchDirectory");
            onChange(f, curr, prev);
        });
    };

    r.moveFile = function(originalFilePath, newFilePath, callback)
    {
        debugStart("Start store.moveFile");
        engine.moveFile(_enginePath(originalFilePath), _enginePath(newFilePath), function(err) {
            debugFinish("Finish store.moveFile");
            callback(err);
        });
    };

    r.readStream = function(filePath, callback)
    {
        debugStart("Start store.readStream");
        engine.readStream(_enginePath(filePath), function(err, stream) {

            // connect a default error handler
            if (stream)
            {
                stream.once('error', function (e) {
                    console.log("readStream for: " + filePath + ", error: " + e);
                });
            }

            debugFinish("Finish store.readStream");
            callback(err, stream);
        });
    };

    r.writeStream = function(filePath, callback)
    {
        debugStart("Start store.writeStream");
        engine.writeStream(_enginePath(filePath), function(err, stream) {

            // connect a default error handler
            if (stream)
            {
                stream.once('error', function (e) {
                    console.log("writeStream for: " + filePath + ", error: " + e);
                });
            }

            debugFinish("Finish store.writeStream");
            callback(err, stream);
        });
    };

    r.fileStats = function(filePath, callback)
    {
        debugStart("Start store.fileStats");
        engine.fileStats(_enginePath(filePath), function(err, stats) {
            debugFinish("Finish store.fileStats");
            callback(err, stats);
        });
    };

    r.matchFiles = function(directoryPath, regexPattern, callback)
    {
        debugStart("Start store.matchFiles");
        engine.matchFiles(_enginePath(directoryPath), regexPattern, function(err, matches) {

            // strip out engine path
            if (matches && matches.length > 0)
            {
                var ep = _enginePath(directoryPath);
                for (var i = 0; i < matches.length; i++)
                {
                    if (matches[i].indexOf(ep) === 0)
                    {
                        matches[i] = matches[i].substring(ep.length);
                    }
                }
            }

            debugFinish("Finish store.matchFiles");
            callback(err, matches);
        });
    };

    /**
     * Mounts a new store at a path within a current store.
     *
     * @param mountPath
     */
    r.mount = function(mountPath)
    {
        var newOffsetPath = mountPath;
        if (offsetPath) {
            newOffsetPath = path.join(offsetPath, mountPath);
        }

        return require("./store")(engine, engineType, engineId, engineConfiguration, host, newOffsetPath);
    };

    r.debug = function()
    {
        return "Engine Path: " + _enginePath("/");
    };

    /**
     * Calculates a path to the asset within the store given an absolute path.
     * Returns null if cannot be resolved.
     *
     * @param absolutePath
     */
    r.pathWithinStore = function(absolutePath)
    {
        if (absolutePath && absolutePath.indexOf(basePath()) === 0)
        {
            return absolutePath.substring(basePath().length);
        }

        return null;
    };

    return r;
};

