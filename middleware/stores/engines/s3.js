var path = require('path');
var http = require('http');

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
            Key: key
        };
        s3.headObject(params, function(err, data) {

            if (err) {
                callback(false);
                return;
            }

            callback(true);
        });

        return false;
    };

    var existsDirectory = r.existsDirectory = function(directoryPath, callback)
    {
        var key = _toKey(directoryPath);

        // list all objects in this directory
        // if > 0, then directory is said to exist
        var params = {
            Bucket: engineConfig.bucket,
            Prefix: key
        };
        s3.listObjects(params, function (err, data) {

            if (err) {
                callback(err);
                return;
            }

            if (data.Contents.length > 0) {
                callback(true);
            }
            else {
                callback(false);
            }
        });
    };

    var removeFile = r.removeFile = function(filePath, callback)
    {
        var key = _toKey(filePath);

        var params = {
            "Bucket": engineConfig.bucket,
            "Key": key
        };

        s3.deleteObject(params, function(err, data) {
            callback(err);
        });
    };

    var removeDirectory = r.removeDirectory = function(directoryPath, callback)
    {
        var key = _toKey(directoryPath);

        // list all objects in this directory and remove it
        var params = {
            Bucket: engineConfig.bucket,
            Prefix: key
        };
        s3.listObjects(params, function(err, data) {

            if (err) {
                callback(err);
                return;
            }

            var objects = [];
            for (var i = 0; i < data.Contents.length; i++)
            {
                objects.push({
                    "Key": data.Contents[i].Key
                });
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

    var listFiles = r.listFiles = function(directoryPath, callback)
    {
        var key = _toKey(directoryPath);

        var params = {
            Bucket: engineConfig.bucket,
            Prefix: key
        };
        s3.listObjects(params, function(err, data) {

            if (err) {
                callback(err);
                return;
            }

            var filenames = [];

            for (var i = 0; i < data.Contents.length; i++)
            {
                filenames.push(data.Contents[i].Key);
            }

            callback(err, filenames);
        });
    };

    var sendFile = r.sendFile = function(res, filePath, cacheInfo, callback)
    {
        readStream(filePath, function(err, stream) {

            if (err)
            {
                try
                {
                    util.status(res, 503).send(err).end();
                }
                catch(e) {}
                return;
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
                try
                {
                    util.status(res, 503).send(err).end();
                }
                catch (e) { }
                return;
            }

            util.applyResponseContentType(res, cacheInfo, filePath);

            var filename = path.basename(filePath);

            var contentDisposition = 'attachment';
            if (filename) {
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
            "Key": key,
            "ACL": "authenticated-read",
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
            Key: key
        };
        s3.getObject(params, function(err, data) {

            if (err)
            {
                callback(err);
                return;
            }

            var body = data.Body;
            if (!body)
            {
                callback({
                    "message": "Null or missing body"
                });
            }
            else if ((typeof(body.length) != "undefined") && body.length === 0)
            {
                callback({
                    "message": "File was size 0"
                });
                return;
            }

            callback(null, body);
        });
    };

    // NOT IMPLEMENTED IN S3
    r.watchDirectory = function(directoryPath, onChange)
    {
    };

    r.moveFile = function(originalFilePath, newFilePath, callback)
    {
        var originalKey = _toKey(originalFilePath);
        var newKey = _toKey(newFilePath);

        // copy object
        var params = {
            Bucket: engineConfig.bucket,
            CopySource: engineConfig.bucket + "/" + originalKey,
            Key: newKey,
            ACL: "authenticated-read"
        };
        s3.copyObject(params, function(err, data) {
            callback(err);

            // delete original object
            var params = {
                "Bucket": engineConfig.bucket,
                "Key": originalFilePath
            };
            s3.deleteObject(params, function(err, data) {
                callback(err);
            });
        });
    };

    var readStream = r.readStream = function(filePath, callback)
    {
        var key = _toKey(filePath);

        canoe.createPrefixedReadStream({
            Bucket: engineConfig.bucket,
            Prefix: key
        }, function (err, readable) {
            callback(err, readable);
        });
    };

    var writeStream = r.writeStream = function(filePath, callback)
    {
        var key = _toKey(filePath);

        canoe.createWriteStream({
            Bucket: engineConfig.bucket,
            Key: key
        }, function(err, writableStream) {
            callback(err, writableStream);
        });
    };

    r.fileStats = function(filePath, callback)
    {
        var key = _toKey(filePath);

        var params = {
            Bucket: engineConfig.bucket,
            Key: key
        };
        s3.headObject(params, function(err, data) {
            if (err) {
                callback(false);
                return;
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
            Prefix: key
        };

        s3.listObjects(params, function(err, data) {

            if (err) {
                callback(err);
                return;
            }

            var regex = new RegExp(regexPattern);
            var filenames = [];

            for (var i = 0; i < data.Contents.length; i++)
            {
                var filename = data.Contents[i].Key;

                if (regex.test(filename))
                {
                    filenames.push(filename);
                }
            }

            callback(err, filenames);
        });
    };

    return r;
};

