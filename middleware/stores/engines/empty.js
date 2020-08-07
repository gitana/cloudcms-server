var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../../../util/util");

/**
 * Not in use.
 *
 * Empty template to mark out the interface.
 *
 * @return {Function}
 */
exports = module.exports = function(engineId, engineType, engineConfig)
{
    var r = {};

    var init = r.init = function(callback)
    {
        callback();
    };

    var allocated = r.allocated = function(basePath, callback)
    {
        callback(false);
    };

    var existsFile = r.existsFile = function(filePath, callback)
    {
        callback(false);
    };

    var existsDirectory = r.existsDirectory = function(directoryPath, callback)
    {
        callback(false);
    };

    var removeFile = r.removeFile = function(filePath, options, callback)
    {
        if (typeof(options) === "function") {
            callback = options;
            options = null;
        }

        callback();
    };

    var removeDirectory = r.removeDirectory = function(directoryPath, options, callback)
    {
        if (typeof(options) === "function") {
            callback = options;
            options = null;
        }

        callback();
    };

    var listFiles = r.listFiles = function(directoryPath, callback)
    {
        callback(null, []);
    };

    var sendFile = r.sendFile = function(res, filePath, cacheInfo, callback)
    {
        callback(null);
    };

    var downloadFile = r.downloadFile = function(res, filePath, filename, cacheInfo, callback)
    {
        callback(null);
    };

    r.writeFile = function(filePath, data, callback)
    {
        callback(null);
    };

    r.readFile = function(filePath, callback)
    {
        callback(null, null); //data
    };

    r.watchDirectory = function(directoryPath, onChange)
    {
    };

    r.moveFile = function(originalFilePath, newFilePath, callback)
    {
        callback(null);
    };

    var readStream = r.readStream = function(filePath, callback)
    {
        callback(null, null); // stream
    };

    var writeStream = r.writeStream = function(filePath, callback)
    {
        callback(null, null); // stream
    };

    r.fileStats = function(filePath, callback)
    {
        callback(null, null); // stats
    };

    r.matchFiles = function(directoryPath, regexPattern, callback)
    {
        callback(null, []);
    };

    return r;
};

