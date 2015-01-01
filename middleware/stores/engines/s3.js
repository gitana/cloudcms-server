var path = require('path');
var fs = require('fs');
var http = require('http');

var AWS = require('aws-sdk');

var util = require("../../../util/util");

var Canoe = require("canoe");

/**
 * A store that works directly against S3.
 *
 * @return {Function}
 */
exports = module.exports = function(engineId, engineType, engineConfig)
{
    var s3 = null;
    var tempDirectory = null;

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

        util.createTempDirectory(function(err, _tempDirectory) {
            tempDirectory = _tempDirectory;
        });

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

    // NOT IMPLEMENTED IN S3
    var createDirectory = r.createDirectory = function(directoryPath, callback)
    {
        callback();
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

    var sendFile = r.sendFile = function(res, filePath, callback)
    {
        var key = _toKey(filePath);

        var tempFilePath = util.generateTempFilePath(filePath);

        var stream = fs.createWriteStream(tempFilePath);
        s3.getObject({
            Bucket: engineConfig.bucket,
            Key: key
        }).on('httpData', function(chunk) {
            stream.write(chunk);
        }).on('complete', function() {
            stream.end();

            var mimetype = null;

            var filename = path.basename(filePath);
            if (filename) {
                var ext = path.extname(filename);
                if (ext) {
                    mimetype = mime.lookup(ext);
                }
            }

            if (mimetype) {
                res.setHeader("Content-Type", mimetype);
            }

            var options = {};

            res.sendFile(tempFilePath, options, function (err) {

                // some kind of IO issue streaming back
                try {
                    res.status(503).send(err);
                } catch (e) {
                }
                res.end();

                callback(err);
            });

        }).on("error", function(err) {
            res.status(503).end();
            callback();
        }).send();
    };

    var downloadFile = r.downloadFile = function(res, filePath, filename, callback)
    {
        var key = _toKey(filePath);

        var tempFilePath = util.generateTempFilePath(filePath);

        var stream = fs.createWriteStream(tempFilePath);
        s3.getObject({
            Bucket: engineConfig.bucket,
            Key: key
        }).on('httpData', function(chunk) {
            stream.write(chunk);
        }).on('complete', function() {
            stream.end();

            var filename = path.basename(filePath);

            res.download(tempFilePath, filename, function(err) {
                callback(err);
            });

        }).on("error", function(err) {
            res.status(503).end();
            callback();
        }).send();
    };

    r.writeFile = function(filePath, data, callback)
    {
        var key = _toKey(filePath);

        console.log("BUCKET: " + engineConfig.bucket);
        console.log("FILEPATH: " + filePath);
        console.log("DATA: " + data);

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
            callback(err, data.Body);
        });
    };

    // NOT IMPLEMENTED IN S3
    r.watchDirectory = function(directoryPath, onChange)
    {
    };

    r.renameFile = function(originalFilePath, newFilePath, callback)
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

    r.readStream = function(filePath, callback)
    {
        var key = _toKey(filePath);

        var canoe = new Canoe(s3);
        canoe.createPrefixedReadStream({
            Bucket: engineConfig.bucket,
            Prefix: key
        }, function (err, readable) {
            callback(err, readable);
        });
    };

    r.writeStream = function(filePath, callback)
    {
        var key = _toKey(filePath);

        var canoe = new Canoe(s3);
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

            callback(null, stats);
        });
    };

    return r;
};

