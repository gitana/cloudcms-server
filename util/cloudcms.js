var path = require('path');
//var fs = require('fs');
var util = require("./util");

var http = require("http");
var https = require("https");

var request = require("./request");

exports = module.exports = function()
{
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
            return callback({
                "message": "Missing repositoryId in ensureContentDirectory()"
            });
        }

        if (!branchId)
        {
            return callback({
                "message": "Missing branchId in ensureContentDirectory()"
            });
        }

        if (!locale)
        {
            return callback({
                "message": "Missing locale in ensureContentDirectory()"
            });
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
        var cacheFilePath = toCacheFilePath(filePath);

        // read the cache file (if it exists)
        contentStore.readFile(cacheFilePath, function(err, cacheInfoString) {

            if (err)
            {
                // nothing found
                return callback({
                    "message": "Nothing cached on disk"
                });
            }

            if (!cacheInfoString)
            {
                // nothing found
                return callback({
                    "message": "Nothing cached on disk"
                });
            }

            var invalidate = function () {
                safeRemove(contentStore, filePath, function (err) {
                    safeRemove(contentStore, cacheFilePath, function (err) {
                        callback();
                    });
                });
            };

            // safety check: does the actual physical asset exists?
            contentStore.existsFile(filePath, function(exists) {

                if (!exists)
                {
                    // clean up
                    return invalidate();
                }

                // check the file size on disk
                // if size 0, invalidate
                contentStore.fileStats(filePath, function(err, stats) {

                    if (err || !stats || stats.size === 0)
                    {
                        // clean up
                        return invalidate();
                    }

                    // there is something on disk
                    // we should serve it back (if we can)

                    var cacheInfo = JSON.parse(cacheInfoString);
                    if (isCacheInfoValid(cacheInfo))
                    {
                        // all good!

                        // clean up here in case charset is part of mimetype
                        if (cacheInfo.mimetype)
                        {
                            var x = cacheInfo.mimetype.indexOf(";");
                            if (x > -1)
                            {
                                cacheInfo.mimetype = cacheInfo.mimetype.substring(0, x);
                            }
                        }

                        callback(null, cacheInfo);
                    }
                    else
                    {
                        // bad cache file
                        invalidate();
                    }
                });
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
     * Ensures that the write stream is closed.
     *
     * @param writeStream
     */
    var closeWriteStream = function(writeStream)
    {
        try { writeStream.end(); } catch(e) { }
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
                    return cb({
                        "message": "Failed to refresh authentication token: " + JSON.stringify(err),
                        "err": previousError,
                        "invalidateGitanaDriver": true
                    });
                }
                else
                {
                    // try again with attempt count + 1
                    setTimeout(function() {
                        _writeToDisk(contentStore, gitana, uri, filePath, attemptCount + 1, maxAttemptsAllowed, previousError, cb)
                    }, 250);
                }
            });
        };

        var _writeToDisk = function(contentStore, gitana, uri, filePath, attemptCount, maxAttemptsAllowed, previousError, cb)
        {
            if (attemptCount === maxAttemptsAllowed)
            {
                return cb({
                    "message": "Maximum number of connection attempts exceeded(" + maxAttemptsAllowed + ")",
                    "err": previousError
                });
            }
            
            var failFast = function(contentStore, filePath, cb) {
                var triggered = false;
                
                return function(tempStream, err)
                {
                    // don't allow this to be called twice
                    if (triggered) {
                        return;
                    }
    
                    triggered = true;
                    
                    // ensure stream is closed
                    if (tempStream) {
                        closeWriteStream(tempStream);
                    }
    
                    // ensure cleanup
                    return safeRemove(contentStore, filePath, function () {
                        cb(err);
                    });
                };
            }(contentStore, filePath, cb);
            
            contentStore.writeStream(filePath, function(err, tempStream) {

                if (err) {
                    return failFast(tempStream, err);
                }

                var cacheFilePath = toCacheFilePath(filePath);

                // headers
                var headers = {};

                // add "authorization" for OAuth2 bearer token
                var headers2 = gitana.platform().getDriver().getHttpHeaders();
                headers["Authorization"] = headers2["Authorization"];

                var agent = http.globalAgent;
                if (process.env.GITANA_PROXY_SCHEME === "https")
                {
                    agent = https.globalAgent;
                }

                var URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH) + uri;
                request({
                    "method": "GET",
                    "url": URL,
                    "qs": {},
                    "headers": headers,
                    "responseType": "stream"
                }, function(err, response) {
    
                    if (err) {
                        closeWriteStream(tempStream);
                        return cb(err);
                    }
    
                    if (response.status >= 200 && response.status <= 204)
                    {
                        response.data.pipe(tempStream).on("close", function (err) {
            
                            if (err) {
                                // some went wrong at disk io level?
                                return failFast(tempStream, err);
                            }
            
                            contentStore.existsFile(filePath, function (exists) {
                
                                if (exists) {
                    
                                    // write cache file
                                    var cacheInfo = buildCacheInfo(response);
                                    if (!cacheInfo) {
                                        return cb(null, filePath, null);
                                    }
                    
                                    contentStore.writeFile(cacheFilePath, JSON.stringify(cacheInfo, null, "    "), function (err) {
                        
                                        if (err) {
                                            // failed to write cache file, thus the whole thing is invalid
                                            return safeRemove(contentStore, cacheFilePath, function () {
                                                failFast(tempStream, {
                                                    "message": "Failed to write cache file: " + cacheFilePath + ", err: " + JSON.stringify(err)
                                                });
                                            });
                                        }
                        
                                        cb(null, filePath, cacheInfo);
                                    });
                                } else {
                                    // for some reason, file wasn't found
                                    // roll back the whole thing
                                    safeRemove(contentStore, cacheFilePath, function () {
                                        failFast(tempStream, {
                                            "message": "Failed to verify written cached file: " + filePath
                                        });
                                    });
                                }
                            });
            
                        }).on("error", function (err) {
                            failFast(tempStream, err);
                        });
                    }
                    else
                    {
                        // some kind of http error (usually permission denied or invalid_token)
        
                        var body = "";
        
                        response.data.on('data', function (chunk) {
                            body += chunk;
                        });
        
                        response.data.on('end', function () {
            
                            var afterCleanup = function () {
                
                                // see if it is "invalid_token"
                                // if so, we can automatically retry
                                var isInvalidToken = false;
                                try {
                                    var json = JSON.parse(body);
                                    if (json && json.error === "invalid_token") {
                                        isInvalidToken = true;
                                    }
                                } catch (e) {
                                    // swallow
                                }
                
                                if (isInvalidToken) {
                                    // fire for retry
                                    return _refreshAccessTokenAndRetry(contentStore, gitana, uri, filePath, attemptCount, maxAttemptsAllowed, {
                                        "message": "Unable to load asset from remote store",
                                        "code": response.status,
                                        "body": body
                                    }, cb);
                                }
                
                                // otherwise, it's not worth retrying at this time
                                cb({
                                    "message": "Unable to load asset from remote store",
                                    "code": response.status,
                                    "body": body
                                });
                            };
            
                            // ensure stream is closed
                            closeWriteStream(tempStream);
            
                            // clean things up
                            safeRemove(contentStore, cacheFilePath, function () {
                                safeRemove(contentStore, filePath, function () {
                                    afterCleanup();
                                });
                            });
                        });
        
                    }
                });

                tempStream.on("error", function (e) {
                    process.log("Temp stream errored out");
                    process.log(e);
    
                    failFast(tempStream, e);
                });
            });

        };

        _writeToDisk(contentStore, gitana, uri, filePath, 0, 2, null, function(err, filePath, cacheInfo) {
            callback(err, filePath, cacheInfo);
        });

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
        // ensure path starts with "/"
        if (nodePath && !nodePath.startsWith("/")) {
            nodePath = "/" + nodePath;
        }

        // base storage directory
        generateContentDirectoryPath(contentStore, repositoryId, branchId, nodeId, locale, function(err, contentDirectoryPath) {

            if (err) {
                return callback(err);
            }

            var filePath = contentDirectoryPath;
            if (nodePath) {
                filePath = path.join(contentDirectoryPath, "paths", nodePath);
            }

            if (attachmentId) {
                filePath = path.join(filePath, "attachments", attachmentId);
            } else {
                filePath = path.join(contentDirectoryPath, "metadata.json");
            }

            var doWork = function() {

                // if the cached asset is on disk, we serve it back
                readFromDisk(contentStore, filePath, function (err, cacheInfo) {

                    if (!err && cacheInfo) {
                        return callback(err, filePath, cacheInfo);
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
                            process.log("writeToDisk error, err: " + err.message + ", body: " + err.body);
                            return callback(err);
                        }

                        //process.log("Fetched: " + assetPath);
                        //process.log("Retrieved from server: " + filePath);
                        callback(null, filePath, cacheInfo);
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
                            contentStore.removeFile(toCacheFilePath(filePath), function (err) {
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

        // ensure path starts with "/"
        if (nodePath && !nodePath.startsWith("/")) {
            nodePath = "/" + nodePath;
        }

        // base storage directory
        generateContentDirectoryPath(contentStore, repositoryId, branchId, nodeId, locale, function(err, contentDirectoryPath) {

            if (err) {
                return callback(err);
            }

            var filePath = contentDirectoryPath;
            if (nodePath) {
                filePath = path.join(contentDirectoryPath, "paths", nodePath);
            }

            filePath = path.join(filePath, "previews", previewId);

            var doWork = function() {

                // if the cached asset is on disk, we serve it back
                readFromDisk(contentStore, filePath, function (err, cacheInfo) {

                    if (!err && cacheInfo) {

                        // if no mimetype or mimetype matches, then hand back
                        if (!mimetype || (cacheInfo.mimetype === mimetype)) {
                            return callback(null, filePath, cacheInfo);
                        }
                    }

                    // either there was an error (in which case things were cleaned up)
                    // or there was nothing on disk

                    var uri = "/repositories/" + repositoryId + "/branches/" + branchId + "/nodes/" + nodeId + "/preview/" + previewId;
                    // force content disposition information to come back
                    uri += "?a=true";
                    if (forceReload) {
                        uri += "&force=" + forceReload;
                    }
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

                    writeToDisk(contentStore, gitana, uri, filePath, function (err, filePath, responseHeaders) {

                        if (err) {
                            
                            if (err.code === 404) {
                                return callback();
                            }

                            process.log("writeToDisk outer fail, err: " + err.message + " for URI: " + uri);
                            return callback(err);
                        }

                        callback(null, filePath, responseHeaders);
                    });
                });
            };

            /////////////////////////////////

            // if force reload, delete from disk if exist
            if (forceReload)
            {
                contentStore.existsFile(filePath, function (exists) {

                    if (exists)
                    {
                        contentStore.removeFile(filePath, function (err) {
                            contentStore.removeFile(toCacheFilePath(filePath), function (err) {
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

        //process.log("Considering: " + contentDirectoryPath);
        contentStore.existsDirectory(contentDirectoryPath, function(exists) {

            //process.log("Exists -> " + exists);

            if (!exists)
            {
                return callback();
            }

            contentStore.removeDirectory(contentDirectoryPath, function(err) {

                process.log(" > Invalidated Node [repository: " + repositoryId + ", branch: " + branchId + ", node: " + nodeId + "]");

                callback(err, true);
            });

        });
    };

    var invalidateNodePaths = function(contentStore, repositoryId, branchId, paths, callback)
    {
        if (!paths)
        {
            return callback();
        }

        var rootPath = paths["root"];
        if (!rootPath)
        {
            return callback();
        }

        // base storage directory
        // TODO: support non-root and non-default locale?
        var rootCachePath = path.join(repositoryId, branchId, "root", "default", "paths", rootPath);

        contentStore.existsDirectory(rootCachePath, function(exists) {

            if (!exists)
            {
                return callback();
            }

            contentStore.removeDirectory(rootCachePath, function(err) {

                process.log(" > Invalidated Path [repository: " + repositoryId + ", branch: " + branchId + ", path: " + rootPath + "]");

                callback(err, true);
            });

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
                    if (forceReload) {
                        uri += "&force=" + forceReload;
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

    // lock helpers

    var _lock_identifier = function()
    {
        var args = Array.prototype.slice.call(arguments);

        return args.join("_");
    };

    var _LOCK = function(store, lockIdentifier, workFunction)
    {
        process.locks.lock(store.id + "_" + lockIdentifier, workFunction);
    };


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.toCacheFilePath = toCacheFilePath;
    r.buildCacheInfo = buildCacheInfo;
    r.safeRemove = safeRemove;
    
    r.download = function(contentStore, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback)
    {
        // claim a lock around this node for this server
        _LOCK(contentStore, _lock_identifier(repositoryId, branchId, nodeId), function(err, releaseLockFn) {

            // workhorse - pass releaseLockFn back to callback
            downloadNode(contentStore, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, function (err, filePath, cacheInfo) {
                callback(err, filePath, cacheInfo, releaseLockFn);
            });

        });
    };

    r.preview = function(contentStore, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        // claim a lock around this node for this server
        _LOCK(contentStore, _lock_identifier(repositoryId, branchId, nodeId), function(err, releaseLockFn) {

            // workhorse - pass releaseLockFn back to callback
            previewNode(contentStore, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, function(err, filePath, cacheInfo) {
                callback(err, filePath, cacheInfo, releaseLockFn);
            });

        });
    };

    r.invalidate = function(contentStore, repositoryId, branchId, nodeId, paths, callback)
    {
        // claim a lock around this node for this server
        _LOCK(contentStore, _lock_identifier(repositoryId, branchId, nodeId), function(err, releaseLockFn) {

            invalidateNode(contentStore, repositoryId, branchId, nodeId, function () {
                invalidateNodePaths(contentStore, repositoryId, branchId, paths, function() {

                    // release lock
                    releaseLockFn();

                    // all done
                    callback();

                });
            });
        });
    };

    r.downloadAttachable = function(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, forceReload, callback)
    {
        // claim a lock around this node for this server
        _LOCK(contentStore, _lock_identifier(datastoreId, objectId), function(err, releaseLockFn) {

            // workhorse - pass releaseLockFn back to callback
            downloadAttachable(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, forceReload, function(err, filePath, cacheInfo) {
                callback(err, filePath, cacheInfo, releaseLockFn);
            });

        });
    };

    r.previewAttachable = function(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        // claim a lock around this node for this server
        _LOCK(contentStore, _lock_identifier(datastoreId, objectId), function(err, releaseLockFn) {

            // workhorse - pass releaseLockFn back to callback
            previewAttachable(contentStore, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, previewId, size, mimetype, forceReload, function (err, filePath, cacheInfo) {
                callback(err, filePath, cacheInfo, releaseLockFn);
            });

        });
    };

    r.invalidateAttachable = function(contentStore, datastoreTypeId, datastoreId, objectTypeId, objectId, callback)
    {
        // claim a lock around this node for this server
        _LOCK(contentStore, _lock_identifier(datastoreId, objectId), function(err, releaseLockFn) {

            // TODO: not implemented
            callback();

            releaseLockFn();
        });
    };

    return r;
}();
