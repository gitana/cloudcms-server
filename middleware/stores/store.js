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
    var DEBUG_LOG = true;
    var debugLog = function(text) {
        if (DEBUG_LOG) {
            console.log(text);
        }
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

    r.infoDirPath = function()
    {
        return _enginePath("/");
    };

    r.allocated = function(callback)
    {
        debugLog("Start store.allocated");
        engine.allocated(_enginePath("/"), function(allocated) {
            debugLog("Finish store.allocated");
           callback(allocated);
        });
    };

    r.cleanup = function(callback)
    {
        debugLog("Start store.cleanup");
        engine.removeDirectory(_enginePath("/"), function(err) {
            debugLog("Finish store.cleanup");
            callback(err);
        });
    };

    //////////////////////////////////////////////////

    r.existsFile = function(filePath, callback)
    {
        debugLog("Start store.existsFile");
        engine.existsFile(_enginePath(filePath), function(exists) {
            debugLog("Finish store.existsFile");
            callback(exists);
        });
    };

    r.existsDirectory = function(directoryPath, callback)
    {
        debugLog("Start store.existsDirectory");
        engine.existsDirectory(_enginePath(directoryPath), function(exists) {
            debugLog("Finish store.existsDirectory");
            callback(exists);
        });
    };

    r.createDirectory = function(directoryPath, callback)
    {
        debugLog("Start store.createDirectory");
        engine.createDirectory(_enginePath(directoryPath), function(err) {
            debugLog("Finish store.createDirectory");
            callback(err);
        });
    };

    r.removeFile = r.deleteFile = function(filePath, callback)
    {
        debugLog("Start store.deleteFile");
        engine.removeFile(_enginePath(filePath), function(err) {
            debugLog("Finish store.deleteFile");
            callback(err);
        });
    };

    r.removeDirectory = r.deleteDirectory = function(directoryPath, callback)
    {
        debugLog("Start store.deleteDirectory");
        engine.removeDirectory(_enginePath(directoryPath), function(err) {
            debugLog("Finish store.deleteDirectory");
            callback(err);
        });
    };

    r.listFiles = function(directoryPath, callback)
    {
        debugLog("Start store.listFiles");
        engine.listFiles(_enginePath(directoryPath), function(err, filenames) {
            debugLog("Finish store.listFiles");
            callback(err, filenames);
        });
    };

    r.sendFile = function(res, filePath, callback)
    {
        debugLog("Start store.sendFile");
        engine.sendFile(res, _enginePath(filePath), function(err) {
            debugLog("Finish store.sendFile");
            callback(err);
        });
    };

    r.downloadFile = function(res, filePath, filename, callback)
    {
        debugLog("Start store.downloadFile");
        engine.downloadFile(res, _enginePath(filePath), filename, function(err) {
            debugLog("Finish store.downloadFile");
            callback(err);
        });
    };

    r.writeFile = function(filePath, data, callback)
    {
        debugLog("Start store.writeFile");
        engine.writeFile(_enginePath(filePath), data, function(err) {
            debugLog("Finish store.writeFile");
            callback(err);
        });
    };

    r.readFile = function(path, callback)
    {
        debugLog("Start store.readFile");
        engine.readFile(_enginePath(path), function(err, data) {
            debugLog("Finish store.readFile");
            callback(err, data);
        });
    };

    r.watchDirectory = function(directoryPath, onChange)
    {
        debugLog("Start store.watchDirectory");
        engine.watchDirectory(_enginePath(directoryPath), function(f, curr, prev) {
            debugLog("Finish store.watchDirectory");
            onChange(f, curr, prev);
        });
    };

    r.renameFile = function(originalFilePath, newFilePath, callback)
    {
        debugLog("Start store.renameFile");
        engine.renameFile(_enginePath(originalFilePath), _enginePath(newFilePath), function(err) {
            debugLog("Finish store.renameFile");
            callback(err);
        });
    };

    r.readStream = function(filePath, callback)
    {
        debugLog("Start store.readStream");
        engine.readStream(_enginePath(filePath), function(err, stream) {
            debugLog("Finish store.readStream");
            callback(err, stream);
        });
    };

    r.writeStream = function(filePath, callback)
    {
        debugLog("Start store.writeStream");
        engine.writeStream(_enginePath(filePath), function(err, stream) {
            debugLog("Finish store.writeStream");
            callback(err, stream);
        });
    };

    r.fileStats = function(filePath, callback)
    {
        debugLog("Start store.fileStats");
        engine.fileStats(_enginePath(filePath), function(err, stats) {
            debugLog("Finish store.fileStats");
            callback(err, stats);
        });
    };

    return r;
};

