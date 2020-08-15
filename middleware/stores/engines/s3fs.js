/**
 * A store that works against S3 but caches files locally for performance.
 *
 * @return {Function}
 */
exports = module.exports = function(engineConfig)
{
    var cachingAdapter = null;

    var r = {};

    var init = r.init = function(callback)
    {
        var s3Store = require("./s3")(engineConfig);
        var settings = {};
        if (engineConfig.cacheDir) {
            settings.cacheDir = engineConfig.cacheDir;
        }
        cachingAdapter = require("./fs-caching-adapter")(s3Store, settings);

        s3Store.init(function() {
            cachingAdapter.init(function() {
                callback();
            });
        });
    };

    var allocated = r.allocated = function(basePath, callback)
    {
        cachingAdapter.allocated(basePath, callback);
    };

    var existsFile = r.existsFile = function(filePath, callback)
    {
        cachingAdapter.existsFile(filePath, callback);
    };

    var existsDirectory = r.existsDirectory = function(directoryPath, callback)
    {
        cachingAdapter.existsDirectory(directoryPath, callback);
    };

    var removeFile = r.removeFile = function(filePath, options, callback)
    {
        cachingAdapter.removeFile(filePath, options, callback);
    };

    var removeDirectory = r.removeDirectory = function(directoryPath, options, callback)
    {
        cachingAdapter.removeDirectory(directoryPath, options, callback);
    };

    var listFiles = r.listFiles = function(directoryPath, options, callback)
    {
        if (!options) {
            options = {};
        }

        cachingAdapter.listFiles(directoryPath, options, callback);
    };

    var sendFile = r.sendFile = function(res, filePath, cacheInfo, callback)
    {
        cachingAdapter.sendFile(res, filePath, cacheInfo, callback);
    };

    var downloadFile = r.downloadFile = function(res, filePath, filename, cacheInfo, callback)
    {
        cachingAdapter.downloadFile(res, filePath, filename, cacheInfo, callback);
    };

    r.writeFile = function(filePath, data, callback)
    {
        cachingAdapter.writeFile(filePath, data, callback);
    };

    r.readFile = function(filePath, callback)
    {
        cachingAdapter.readFile(filePath, callback);
    };

    r.watchDirectory = function(directoryPath, onChange)
    {
        cachingAdapter.watchDirectory(directoryPath, onChange);
    };

    r.moveFile = function(originalFilePath, newFilePath, callback)
    {
        cachingAdapter.moveFile(originalFilePath, newFilePath, callback);
    };

    var readStream = r.readStream = function(filePath, callback)
    {
        cachingAdapter.readStream(filePath, callback);
    };

    var writeStream = r.writeStream = function(filePath, callback)
    {
        cachingAdapter.writeStream(filePath, callback);
    };

    r.fileStats = function(filePath, callback)
    {
        cachingAdapter.fileStats(filePath, callback);
    };

    r.matchFiles = function(directoryPath, regexPattern, callback)
    {
        cachingAdapter.matchFiles(directoryPath, regexPattern, callback);
    };

    return r;
};

