var path = require('path');
var fs = require('fs');
var util = require("./util");
var request = require("request");

exports = module.exports = function()
{
    // two minutes
    var REQUEST_CONNECTION_TIMEOUT_MS = 120000;

    var toCacheFilePath = function(filePath)
    {
        var filename = path.basename(filePath);
        var basedir = path.dirname(filePath);

        return path.join(basedir, "_" + filename + ".cache");
    };

    var generateURL = function(datastoreTypeId, datastoreId, objectTypeId, objectId, previewId)
    {
        var uri = null;

        if (datastoreTypeId == "domain")
        {
            if (objectTypeId == "principal")
            {
                uri = "/domains/" + datastoreId + "/principals/" + objectId;
            }
        }

        if (uri)
        {
            if (previewId)
            {
                uri += "/preview/" + previewId;
            }
        }

        return uri;
    };

    /**
     * Ensures that the content deployment root directory for Cloud CMS assets.
     *
     * This directory looks like:
     *
     *   /hosts
     *      /<host>
     *          /content
     *              /<repositoryId>
     *                  /<branchId>
     *                      /<nodeId>
     *                          /<localeKey>
     *                              /attachments
     *                                  <attachmentId>
     *                                  <attachmentId>.cache
     *
     * @param host
     * @param repositoryId
     * @param branchId
     * @parma nodeId
     * @param locale
     * @param callback
     *
     * @return {*}
     */
    var generateContentDirectoryPath = function(contentStore, repositoryId, branchId, nodeId, locale, callback)
    {
        if (!repositoryId)
        {
            callback({
                "message": "Missing repositoryId in ensureContentDirectory()"
            });
            return;
        }

        if (!branchId)
        {
            callback({
                "message": "Missing branchId in ensureContentDirectory()"
            });
            return;
        }

        if (!locale)
        {
            callback({
                "message": "Missing locale in ensureContentDirectory()"
            });
            return;
        }

        var contentDirectoryPath = path.join(repositoryId, branchId, nodeId, locale);

        callback(null, contentDirectoryPath);
    };

    /**
     * Ensures that the content deployment root directory for Cloud CMS assets.
     *
     * This directory looks like:
     *
     *   <rootStore>
     *      /hosts
     *          /<host>
     *              /data
     *                  /<datastoreType>
     *                      /<datastoreId>
     *                          /<objectTypeId>
     *                              /<objectId>
     *                                  /<localeKey>
     *                                      /attachments
     *                                          [attachmentId]
     *                                          [attachmentId].cache
     *
     * @param contentStore
     * @param datastoreTypeId
     * @param datastoreId
     * @param objectTypeId
     * @param objectId
     * @param locale
     * @param callback
     *
     * @return {*}
     */
    var generateAttachableDirectoryPath = function(contentStore, datastoreTypeId, datastoreId, objectTypeId, objectId, locale, callback)
    {
        var attachableDirectoryPath = path.join(datastoreTypeId, datastoreId, objectTypeId, objectId, locale);

        callback(null, attachableDirectoryPath);
    };

    /**
     * Reads an existing asset and cacheInfo (if exists).
     *
     * @param contentStore
     * @param filePath
     * @param callback
     */
    var readFromDisk = function(contentStore, filePath, callback)
    {
        // the cache file must exist on disk
        //var cacheFilePath = "_" + filePath + ".cache";
        var cacheFilePath = toCacheFilePath(filePath);

        // read the cache file (if it exists)
        contentStore.readFile(cacheFilePath, function(err, cacheInfoString) {

            if (err)
            {
                // nothing found
                callback({
                    "message": "Nothing cached on disk"
                });

                return;
            }

            if (!cacheInfoString)
            {
                // nothing found
                callback({
                    "message": "Nothing cached on disk"
                });

                return;
            }

            var invalidate = function () {
                safeRemove(contentStore, filePath, function (err) {
                    safeRemove(contentStore, cacheFilePath, function (err) {
                        callback();
                    })
                });
            };

            // safety check: does the actual physical asset exists?
            contentStore.existsFile(filePath, function(exists) {

                if (!exists)
                {
                    // clean up
                    invalidate();
                    return;
                }

                // there is something on disk
                // we should serve it back (if we can)

                var cacheInfo = JSON.parse(cacheInfoString);
                if (isCacheInfoValid(cacheInfo)) {
                    // all good!

                    // clean up here in case charset is part of mimetype
                    if (cacheInfo.mimetype) {
                        var x = cacheInfo.mimetype.indexOf(";");
                        if (x > -1) {
                            cacheInfo.mimetype = cacheInfo.mimetype.substring(0, x);
                        }
                    }

                    callback(null, cacheInfo);
                }
                else {
                    // bad cache file
                    invalidate();
                }
            });
        });
    };

    var isCacheInfoValid = function(cacheInfo)
    {
        if (!cacheInfo)
        {
            return false;
        }

        // length must be represented
        if (typeof(cacheInfo.length) === "undefined")
        {
            return false;
        }

        return true;
    };

    var buildCacheInfo = function(response)
    {
        var cacheInfo = null;

        if (response.headers)
        {
            cacheInfo = {};

            for (var k in response.headers)
            {
                var headerName = k.toLowerCase();

                // content-length
                if (headerName == "content-length")
                {
                    cacheInfo.length = response.headers[k];
                }

                // content-type
                if (headerName == "content-type")
                {
                    cacheInfo.mimetype = response.headers[k];

                    // clean up here in case charset is part of mimetype
                    if (cacheInfo.mimetype) {
                        var x = cacheInfo.mimetype.indexOf(";");
                        if (x > -1) {
                            cacheInfo.mimetype = cacheInfo.mimetype.substring(0, x);
                        }
                    }

                }

                // filename
                if (headerName == "content-disposition")
                {
                    // "filename"
                    var contentDispositionHeader = response.headers[k];
                    if (contentDispositionHeader)
                    {
                        var x = contentDispositionHeader.indexOf("filename=");
                        if (x > -1)
                        {
                            cacheInfo.filename = contentDispositionHeader.substring(x + 9);
                        }
                    }
                }
            }
        }

        return cacheInfo;
    };

    var safeRemove = function(contentStore, filePath, callback)
    {
        contentStore.deleteFile(filePath, function(err) {
            callback(err);
        });
    };

    /**
     * Downloads the asset from host:port/path and stores it on disk at filePath.
     *
     * @param contentStore
     * @param gitana
     * @param uri
     * @param filePath
     * @param callback
     */
    var writeToDisk = function(contentStore, gitana, uri, filePath, callback)
    {
        var _refreshAccessTokenAndRetry = function(contentStore, gitana, uri, filePath, attemptCount, maxAttemptsAllowed, previousError, cb)
        {
            // tell gitana driver to refresh access token
            gitana.getDriver().refreshAuthentication(function(err) {

                if (err)
                {
                    cb({
                        "message": "Failed to refresh authentication token: " + JSON.stringify(err),
                        "err": previousError
                    });

                    return;
                }
                else
                {
                    // try again with attempt count + 1
                    _writeToDisk(contentStore, gitana, uri, filePath, attemptCount + 1, maxAttemptsAllowed, previousError, cb)
                }
            });
        };

        var _writeToDisk = function(contentStore, gitana, uri, filePath, attemptCount, maxAttemptsAllowed, previousError, cb)
        {
            if (attemptCount === maxAttemptsAllowed)
            {
                cb({
                    "message": "Maximum number of connection attempts exceeded(" + maxAttemptsAllowed + ")",
                    "err": previousError
                });

                return;
            }

            contentStore.writeStream(filePath, function(err, tempStream) {

                if (err)
                {
                    // ensure cleanup
                    safeRemove(contentStore, filePath, function () {
                        cb(err);
                    });
                    return;
                }

                //var cacheFilePath = filePath + ".cache";
                var cacheFilePath = toCacheFilePath(filePath);

                // headers
                var headers = {};

                // add "authorization" for OAuth2 bearer token
                var headers2 = gitana.platform().getDriver().getHttpHeaders();
                headers["Authorization"] = headers2["Authorization"];

                var URL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT + uri;
                request({
                    "method": "GET",
                    "url": URL,
                    "qs": {},
                    "headers": headers,
                    "timeout": REQUEST_CONNECTION_TIMEOUT_MS
                }).on('response', function (response) {

                    if (response.statusCode >= 200 && response.statusCode <= 204)
                    {
                        response.pipe(tempStream).on("close", function (err) {

                            if (err)
                            {
                                // some went wrong at disk io level?
                                safeRemove(contentStore, filePath, function () {
                                    cb({
                                        "message": "Failed to download: " + JSON.stringify(err)
                                    });
                                });
                            }
                            else
                            {
                                contentStore.existsFile(filePath, function (exists) {

                                    if (exists) {

                                        // write cache file
                                        var cacheInfo = buildCacheInfo(response);
                                        if (cacheInfo)
                                        {
                                            contentStore.writeFile(cacheFilePath, JSON.stringify(cacheInfo, null, "    "), function (err) {

                                                if (err)
                                                {
                                                    // failed to write cache file, thus the whole thing is invalid
                                                    safeRemove(contentStore, cacheFilePath, function () {
                                                        safeRemove(contentStore, filePath, function () {
                                                            cb({
                                                                "message": "Failed to write cache file: " + cacheFilePath
                                                            });
                                                        });
                                                    });
                                                }
                                                else
                                                {
                                                    cb(null, filePath, cacheInfo);
                                                }

                                            });
                                        }
                                        else
                                        {
                                            cb(null, filePath, cacheInfo);
                                        }
                                    }
                                    else
                                    {
                                        // for some reason, file wasn't found
                                        // roll back the whole thing
                                        safeRemove(contentStore, cacheFilePath, function () {
                                            safeRemove(contentStore, filePath, function () {
                                                cb({
                                                    "message": "Failed to verify written cached file: " + filePath
                                                });
                                            });
                                        });
                                    }
                                });
                            }

                        }).on("error", function (err) {
                            console.log("Pipe error: " + err);
                        });
                    }
                    else {
                        // some kind of http error (usually permission denied or invalid_token)

                        var body = "";

                        response.on('data', function (chunk) {
                            body += chunk;
                        });

                        response.on('end', function () {

                            var afterCleanup = function () {

                                // see if it is "invalid_token"
                                // if so, we can automatically retry
                                var isInvalidToken = false;
                                try {
                                    var json = JSON.parse(body);
                                    if (json && json.error == "invalid_token") {
                                        isInvalidToken = true;
                                    }
                                }
                                catch (e) {
                                }

                                if (isInvalidToken) {
                                    // fire for retry
                                    _refreshAccessTokenAndRetry(contentStore, gitana, uri, filePath, attemptCount, maxAttemptsAllowed, {
                                        "message": "Unable to load asset from remote store",
                                        "code": response.statusCode,
                                        "body": body
                                    }, cb);

                                    return;
                                }

                                // otherwise, it's not worth retrying at this time
                                cb({
                                    "message": "Unable to load asset from remote store",
                                    "code": response.statusCode,
                                    "body": body
                                });

                            };

                            // clean things up
                            safeRemove(contentStore, cacheFilePath, function () {
                                safeRemove(contentStore, filePath, function () {
                                    afterCleanup();
                                });
                            });
                        });

                    }

                }).on('error', function (e) {
                    console.log("_writeToDisk request timed out");
                    console.log(e)
                }).end();

                tempStream.on("error", function (e) {
                    console.log("Temp stream errored out");
                    console.log(e);
                });
            });

        };

        _writeToDisk(contentStore, gitana, uri, filePath, 0, 2, null, callback);
    };

    /**
     * Downloads node metadata or an attachment and saves it to disk.
     *
     * @param contentStore
     * @param gitana driver instance
     * @param repositoryId
     * @param branchId
     * @param nodeId
     * @param attachmentId
     * @param nodePath
     * @param locale
     * @param forceReload
     * @param callback
     */
    var downloadNode = function(contentStore, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback)
    {
        // base storage directory
        generateContentDirectoryPath(contentStore, repositoryId, branchId, nodeId, locale, function(err, contentDirectoryPath) {

            if (err) {
                callback(err);
                return;
            }

            var filePath = path.join(contentDirectoryPath, "metadata.json");
            if (nodePath) {
                filePath = path.join(contentDirectoryPath, "paths", nodePath);
            }
            if (attachmentId) {
                filePath = path.join(filePath, "attachments", attachmentId);
            }

            var doWork = function () {

                // if the cached asset is on disk, we serve it back
                readFromDisk(contentStore, filePath, function (err, cacheInfo) {

                    if (!err && cacheInfo) {
                        callback(null, filePath, cacheInfo);
                        return;
                    }

                    // either there was an error (in which case things were cleaned up)
                    // or there was nothing on disk

                    // load asset from server, begin constructing the URI
                    var uri = "/repositories/" + repositoryId + "/branches/" + branchId + "/nodes/" + nodeId;
                    if (attachmentId) {
                        uri += "/attachments/" + attachmentId;
                    }
                    // force content disposition information to come back
                    uri += "?a=true";
                    if (nodePath) {
                        uri += "&path=" + nodePath;
                    }

                    // grab from Cloud CMS and write to disk
                    writeToDisk(contentStore, gitana, uri, filePath, function (err, filePath, cacheInfo) {

                        if (err) {
                            console.log("ERR: " + err.message + ", BODY: " + err.body);
                            callback(err);
                        }
                        else {
                            //console.log("Fetched: " + assetPath);
                            //console.log("Retrieved from server: " + filePath);
                            callback(null, filePath, cacheInfo);
                        }
                    });
                });
            };

            // if force reload, delete from disk if exist
            if (forceReload)
            {
                contentStore.existsFile(filePath, function (exists) {

                    if (exists)
                    {
                        contentStore.removeFile(filePath, function (err) {

                            var cacheFilePath = toCacheFilePath(filePath);

                            contentStore.removeFile(cacheFilePath, function (err) {
                                doWork();
                            });
                        });
                    }
                    else
                    {
                        doWork();
                    }
                });
            }
            else
            {
                doWork();
            }
        });
    };

    var invalidateNode = function(contentStore, repositoryId, branchId, nodeId, callback)
    {
        // base storage directory
        var contentDirectoryPath = path.join(repositoryId, branchId, nodeId);

        contentStore.existsDirectory(contentDirectoryPath, function(exists) {

            if (!exists)
            {
                callback();
                return;
            }

            contentStore.removeDirectory(contentDirectoryPath, function(err) {
                console.log("Invalidated [repository: " + repositoryId + ", branch: " + branchId + ", node: " + nodeId + "]");
                callback(err);
            });

        });
    };

    /**
     * Downloads a preview image for a node.
     *
     * @param contentStore
     * @param gitana driver instance
     * @param repositoryId
     * @param branchId
     * @param nodeId
     * @param nodePath
     * @param attachmentId
     * @param locale
     * @param previewId
     * @param size
     * @param mimetype
     * @param forceReload
     * @param callback
     */
    var previewNode = function(contentStore, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        if (!previewId)
        {
            previewId = attachmentId;
        }

        // base storage directory
        generateContentDirectoryPath(contentStore, repositoryId, branchId, nodeId, locale, function(err, contentDirectoryPath) {

            if (err) {
                callback(err);
                return;
            }

            var filePath = path.join(contentDirectoryPath, "previews", previewId);

            var doWork = function () {

                // if the cached asset is on disk, we serve it back
                readFromDisk(contentStore, filePath, function (err, cacheInfo) {

                    if (!err && cacheInfo) {

                        // if no mimetype or mimetype matches, then hand back
                        if (!mimetype || (cacheInfo.mimetype === mimetype)) {
                            callback(null, filePath, cacheInfo);
                            return;
                        }
                    }

                    // either there was an error (in which case things were cleaned up)
                    // or there was nothing on disk

                    var uri = "/repositories/" + repositoryId + "/branches/" + branchId + "/nodes/" + nodeId + "/preview/" + previewId;
                    // force content disposition information to come back
                    uri += "?a=true";
                    if (nodePath) {
                        uri += "&path=" + nodePath;
                    }
                    if (attachmentId) {
                        uri += "&attachment=" + attachmentId;
                    }
                    if (size > -1) {
                        uri += "&size=" + size;
                    }
                    if (mimetype) {
                        uri += "&mimetype=" + mimetype;
                    }
                    if (forceReload) {
                        uri += "&force=" + forceReload;
                    }

                    writeToDisk(contentStore, gitana, uri, filePath, function (err, filePath, responseHeaders) {

                        if (err) {
                            console.log("ERR: " + err.message + " for URI: " + uri);
                            callback(err);
                        }
                        else {
                            //console.log("Fetched: " + assetPath);
                            //console.log("Retrieved from server: " + filePath);
                            callback(null, filePath, responseHeaders);
                        }
                    });
                });
            };

            // if force reload, delete from disk if exist
            if (forceReload) {
                contentStore.existsFile(filePath, function (exists) {

                    if (exists) {
                        contentStore.removeFile(filePath, function (err) {
                            doWork();
                        });
                    }
                    else {
                        doWork();
                    }
                })
            }
            else {
                doWork();
            }
        });
    };

    /**
     * Downloads attachable metadata or an attachment and saves it to disk.
     *
     * @param contentStore
     * @param gitana driver instance
     * @param datastoreTypeId
     * @param datastoreId
     * @param objectTypeId
     * @param objectId
     * @param attachmentId
     * @param locale
     * @param forceReload
     * @param callback
     */
    var downloadAttachable = function(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, forceReload, callback)
    {
        // base storage directory
        generateAttachableDirectoryPath(contentStore, datastoreTypeId, datastoreId, objectTypeId, objectId, locale, function(err, dataDirectoryPath) {

            if (err) {
                callback(err);
                return;
            }

            var filePath = dataDirectoryPath;
            if (attachmentId) {
                filePath = path.join(filePath, "attachments", attachmentId);
            } else {
                filePath = path.join(filePath, "metadata.json");
            }

            var doWork = function() {

                // if the cached asset is on disk, we serve it back
                readFromDisk(contentStore, filePath, function (err, cacheInfo) {

                    if (!err && cacheInfo) {
                        callback(null, filePath, cacheInfo);
                        return;
                    }

                    // either there was an error (in which case things were cleaned up)
                    // or there was nothing on disk

                    // begin constructing a URI
                    var uri = generateURL(datastoreTypeId, datastoreId, objectTypeId, objectId);
                    if (attachmentId) {
                        uri += "/attachments/" + attachmentId;
                    }
                    // force content disposition information to come back
                    uri += "?a=true";

                    // grab from Cloud CMS and write to disk
                    writeToDisk(contentStore, gitana, uri, filePath, function (err, filePath, cacheInfo) {

                        if (err) {
                            callback(err);
                        }
                        else {
                            callback(null, filePath, cacheInfo);
                        }
                    });
                });
            };

            // if force reload, delete from disk if exist
            if (forceReload)
            {
                contentStore.existsFile(filePath, function(exists) {

                    if (exists)
                    {
                        contentStore.removeFile(filePath, function(err) {
                            doWork();
                        });
                    }
                    else
                    {
                        doWork();
                    }
                })
            }
            else
            {
                doWork();
            }

        });
    };

    /**
     * Downloads a preview image for an attachable.
     *
     * @param contentStore
     * @param gitana driver instance
     * @param datastoreTypeId
     * @param datastoreId
     * @param objectTypeId
     * @param objectId
     * @param attachmentId
     * @param locale
     * @param previewId
     * @param size
     * @param mimetype
     * @param forceReload
     * @param callback
     */
    var previewAttachable = function(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        // base storage directory
        generateAttachableDirectoryPath(contentStore, datastoreTypeId, datastoreId, objectTypeId, objectId, locale, function(err, dataDirectoryPath) {

            if (err) {
                callback(err);
                return;
            }

            if (!previewId)
            {
                previewId = attachmentId;
                //previewId = "_preview";
                //forceReload = true;
            }

            var filePath = path.join(dataDirectoryPath, "previews", previewId);

            var doWork = function() {

                // if the cached asset is on disk, we serve it back
                readFromDisk(contentStore, filePath, function (err, cacheInfo) {

                    if (!err && cacheInfo) {
                        callback(null, filePath, cacheInfo);
                        return;
                    }

                    // either there was an error (in which case things were cleaned up)
                    // or there was nothing on disk

                    // begin constructing a URI
                    var uri = generateURL(datastoreTypeId, datastoreId, objectTypeId, objectId, previewId);
                    uri += "?a=true";
                    if (attachmentId) {
                        uri += "&attachment=" + attachmentId;
                    }
                    if (size > -1) {
                        uri += "&size=" + size;
                    }
                    if (mimetype) {
                        uri += "&mimetype=" + mimetype;
                    }
                    if (forceReload) {
                        uri += "&force=" + forceReload;
                    }

                    writeToDisk(contentStore, gitana, uri, filePath, function (err, filePath, responseHeaders) {

                        if (err) {
                            callback(err);
                        }
                        else {
                            callback(null, filePath, responseHeaders);
                        }
                    });
                });
            };

            // if force reload, delete from disk if exist
            if (forceReload)
            {
                contentStore.existsFile(filePath, function(exists) {

                    if (exists)
                    {
                        contentStore.removeFile(filePath, function(err) {
                            doWork();
                        });
                    }
                    else
                    {
                        doWork();
                    }

                });
            }
            else
            {
                doWork();
            }

        });
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.download = function(contentStore, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback)
    {
        downloadNode(contentStore, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback);
    };

    r.preview = function(contentStore, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        previewNode(contentStore, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, callback);
    };

    r.invalidate = function(contentStore, repositoryId, branchId, nodeId, callback)
    {
        invalidateNode(contentStore, repositoryId, branchId, nodeId, function() {
            callback();
        });
    };

    r.downloadAttachable = function(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, forceReload, callback)
    {
        downloadAttachable(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, forceReload, callback);
    };

    r.previewAttachable = function(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        previewAttachable(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, previewId, size, mimetype, forceReload, callback);
    };

    r.invalidateAttachable = function(contentStore, datastoreTypeId, datastoreId, objectTypeId, objectId, callback)
    {
        callback();
    };

    return r;
}();

