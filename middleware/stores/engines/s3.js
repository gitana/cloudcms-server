var path = require('path');
//var http = require('http');

var AWS = require('aws-sdk');

var util = require("../../../util/util");

var Canoe = require("canoe");

/**
 * A store that works directly against S3.
 *
 * @return {Function}
 */
exports = module.exports = function(engineConfig)
{
    var s3 = null;
    var canoe = null;

    var _toKey = function(filePath)
    {
        var key = filePath;
        if (key.indexOf("/") === 0)
        {
            key = key.substring(1);
        }

        return key;
    };

    var prefixedKey = function(prefix, key)
    {
        var prefixedKey = key;

        if (prefix)
        {
            prefixedKey = path.join(prefix, key);
        }

        return prefixedKey;
    };

    var unprefixedKey = function(prefix, prefixedKey)
    {
        var unprefixedKey = prefixedKey;

        if (prefix)
        {
            if (unprefixedKey.indexOf(prefix) === 0)
            {
                unprefixedKey = unprefixedKey.substring(prefix.length);
            }
        }

        return unprefixedKey;
    };

    var r = {};

    var init = r.init = function(callback)
    {
        // some defaults
        if (!engineConfig.accessKey && process.env.CLOUDCMS_STORE_S3_ACCESS_KEY)
        {
            engineConfig.accessKey = process.env.CLOUDCMS_STORE_S3_ACCESS_KEY;
        }
        if (!engineConfig.secretKey && process.env.CLOUDCMS_STORE_S3_SECRET_KEY)
        {
            engineConfig.secretKey = process.env.CLOUDCMS_STORE_S3_SECRET_KEY;
        }
        if (!engineConfig.bucket && process.env.CLOUDCMS_STORE_S3_BUCKET)
        {
            engineConfig.bucket = process.env.CLOUDCMS_STORE_S3_BUCKET;
        }

        // bail unless we have S3 config details
        if (!engineConfig.accessKey || !engineConfig.secretKey)
        {
            return callback();
        }

        // build S3 client
        s3 = new AWS.S3({
            "accessKeyId": engineConfig.accessKey,
            "secretAccessKey": engineConfig.secretKey
        });

        canoe = new Canoe(s3);

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
        var key = _toKey(filePath);

        var params = {
            Bucket: engineConfig.bucket,
            Key: prefixedKey(engineConfig.prefix, key)
        };
        s3.headObject(params, function(err, data) {

            if (err) {
                return callback(false);
            }

            callback(true);
        });
    };

    var existsDirectory = r.existsDirectory = function(directoryPath, callback)
    {
        var key = _toKey(directoryPath);

        // list all objects in this directory
        // if > 0, then directory is said to exist
        var params = {
            Bucket: engineConfig.bucket,
            Prefix: prefixedKey(engineConfig.prefix, key)
        };
        s3.listObjects(params, function (err, data) {

            if (err)
            {
                return callback(err);
            }

            var exists = (data && data.Contents && data.Contents.length > 0);

            return callback(exists);
        });
    };

    var removeFile = r.removeFile = function(filePath, options, callback)
    {
        if (typeof(options) === "function") {
            callback = options;
            options = null;
        }

        var key = _toKey(filePath);

        var params = {
            "Bucket": engineConfig.bucket,
            "Key": prefixedKey(engineConfig.prefix, key)
        };
        s3.deleteObject(params, function(err, data) {
            callback(err);
        });
    };

    var removeDirectory = r.removeDirectory = function(directoryPath, options, callback)
    {
        if (typeof(options) === "function") {
            callback = options;
            options = null;
        }

        var key = _toKey(directoryPath);

        // list all objects in this directory and remove it
        var params = {
            Bucket: engineConfig.bucket,
            Prefix: prefixedKey(engineConfig.prefix, key)
        };
        s3.listObjects(params, function(err, data) {

            if (err) {
                return callback(err);
            }

            var objects = [];
            for (var i = 0; i < data.Contents.length; i++)
            {
                objects.push({
                    "Key": data.Contents[i].Key
                });
            }

            if (objects.length === 0)
            {
                return callback();
            }

            // delete all of these objects
            var params = {
                Bucket: engineConfig.bucket,
                Delete: {
                    Objects: objects
                }
            };
            s3.deleteObjects(params, function(err, data) {
                callback(err);
            });
        });
    };

    var listFiles = r.listFiles = function(directoryPath, options, callback)
    {
        if (!options) {
            options = {};
        }

        if (options.recursive)
        {
            return doListFilesRecursively(directoryPath, options, callback);
        }

        return doListFiles(directoryPath, options, callback);
    };

    var doListFiles = function(directoryPath, options, callback)
    {
        var key = _toKey(directoryPath);

        var params = {
            Bucket: engineConfig.bucket,
            Prefix: prefixedKey(engineConfig.prefix, key)
        };

        s3.listObjectsV2(params, function(err, data) {

            if (err) {
                return callback(err);
            }

            var filenames = [];

            for (var i = 0; i < data.Contents.length; i++)
            {
                var contentKey = data.Contents[i].Key;
                var cdr = contentKey.substring(key.length);

                if (cdr.indexOf("/") === 0)
                {
                    cdr = cdr.substring(1);
                }

                if (cdr.endsWith("/"))
                {
                    cdr = cdr.substring(0, cdr.length - 1);
                }

                if (cdr.indexOf("/") === -1)
                {
                    // it's a direct child
                    filenames.push(cdr);
                }
            }

            callback(err, filenames);
        });
    };

    var doListFilesRecursively = function(directoryPath, options, callback)
    {
        var key = _toKey(directoryPath);

        var params = {
            Bucket: engineConfig.bucket,
            Prefix: prefixedKey(engineConfig.prefix, key)
        };

        s3.listObjectsV2(params, function(err, data) {

            if (err) {
                return callback(err);
            }

            var filenames = [];

            for (var i = 0; i < data.Contents.length; i++)
            {
                var contentKey = data.Contents[i].Key;
                var cdr = contentKey.substring(params.Prefix.length);

                if (cdr.indexOf("/") === 0)
                {
                    cdr = cdr.substring(1);
                }

                if (cdr.endsWith("/"))
                {
                    cdr = cdr.substring(0, cdr.length - 1);
                }

                console.log("cdr.2: " + cdr);

                filenames.push(cdr);
            }

            callback(err, filenames);
        });
    };

    var sendFile = r.sendFile = function(res, filePath, cacheInfo, callback)
    {
        readStream(filePath, function(err, stream) {

            if (err)
            {
                try {
                    util.status(res, 503).send(err).end();
                } catch (e) { }

                return callback(err);
            }

            util.applyResponseContentType(res, cacheInfo, filePath);

            util.status(res, 200);
            util.sendFile(res, stream, function(err) {
                callback(err);
            });
        });
    };

    var downloadFile = r.downloadFile = function(res, filePath, filename, cacheInfo, callback)
    {
        readStream(filePath, function(err, stream) {

            if (err)
            {
                try {
                    util.status(res, 503).send(err).end();
                } catch (e) { }

                return callback(err);
            }

            util.applyResponseContentType(res, cacheInfo, filePath);

            var filename = path.basename(filePath);

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

            util.status(res, 200);
            util.sendFile(res, stream, function(err) {
                callback(err);
            });
        });
    };

    r.writeFile = function(filePath, data, callback)
    {
        var key = _toKey(filePath);

        var params = {
            "Bucket": engineConfig.bucket,
            "Key": prefixedKey(engineConfig.prefix, key),
            "Body": data
        };
        s3.putObject(params, function(err, data) {
            callback(err);
        });
    };

    r.readFile = function(filePath, callback)
    {
        var key = _toKey(filePath);

        var params = {
            Bucket: engineConfig.bucket,
            Key: prefixedKey(engineConfig.prefix, key)
        };
        s3.getObject(params, function(err, data) {

            if (err)
            {
                return callback(err);
            }

            var body = data.Body;
            if (!body)
            {
                return callback({
                    "message": "Null or missing body"
                });
            }

            if ((typeof(body.length) !== "undefined") && body.length === 0)
            {
                return callback({
                    "message": "File was size 0"
                });
            }

            callback(null, body);
        });
    };

    r.moveFile = function(originalFilePath, newFilePath, callback)
    {
        var originalKey = _toKey(originalFilePath);
        var newKey = _toKey(newFilePath);

        // copy object
        var params = {
            Bucket: engineConfig.bucket,
            CopySource: engineConfig.bucket + "/" + prefixedKey(engineConfig.prefix, originalKey),
            Key: prefixedKey(engineConfig,prefix, newKey)
        };
        s3.copyObject(params, function(err, data) {

            // delete original object
            var params = {
                "Bucket": engineConfig.bucket,
                "Key": prefixedKey(engineConfig.prefix, originalKey)
            };

            s3.deleteObject(params, function(err, data) {
                callback(err);
            });
        });
    };

    var readStream = r.readStream = function(filePath, callback)
    {
        existsFile(filePath, function(exists) {

            if (!exists) {
                return callback({
                    "message": "Key not found"
                });
            }

            var key = _toKey(filePath);

            var params = {
                Bucket: engineConfig.bucket,
                Key: prefixedKey(engineConfig.prefix, key)
            };

            var reader = null;
            try
            {
                reader = s3.getObject(params).createReadStream();
            }
            catch (err)
            {
                return callback(err);
            }

            return callback(null, reader);
        });
    };

    var writeStream = r.writeStream = function(filePath, callback)
    {
        var key = _toKey(filePath);

        canoe.createWriteStream({
            Bucket: engineConfig.bucket,
            Key: prefixedKey(engineConfig.prefix, key)
        }, function(err, writer) {
            callback(err, writer);
        });
    };

    r.fileStats = function(filePath, callback)
    {
        var key = _toKey(filePath);

        var params = {
            Bucket: engineConfig.bucket,
            Key: prefixedKey(engineConfig.prefix, key)
        };
        s3.headObject(params, function(err, data) {

            if (err)
            {
                return callback(false);
            }

            var stats = {};
            stats.directory = false;
            stats.file = true;
            stats.size = data.ContentLength;
            stats.mtimeMs = (data.LastModified && data.LastModified.getTime ? data.LastModified.getTime() : -1);

            callback(null, stats);
        });
    };

    r.matchFiles = function(directoryPath, regexPattern, callback)
    {
        var key = _toKey(directoryPath);

        var params = {
            Bucket: engineConfig.bucket,
            Prefix: prefixedKey(engineConfig.prefix, key)
        };

        s3.listObjects(params, function(err, data) {

            if (err) {
                return callback(err);
            }

            var regex = new RegExp(regexPattern);
            var filenames = [];

            for (var i = 0; i < data.Contents.length; i++)
            {
                var filename = data.Contents[i].Key;

                if (regex.test(filename))
                {
                    filenames.push(unprefixedKey(engineConfig.prefix, filename));
                }
            }

            callback(err, filenames);
        });
    };

    var refresh = r.refresh = function(options, callback)
    {
        callback();
    };

    return r;
};

