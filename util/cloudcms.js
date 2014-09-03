var path = require('path');
var fs = require('fs');
var util = require("util");
var uuid = require("node-uuid");

var mkdirp = require('mkdirp');

exports = module.exports = function(basePath)
{
    var storage = require("./storage")(basePath);

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
    var ensureContentDirectory = function(host, repositoryId, branchId, nodeId, locale, callback)
    {
        if (!host) {
            host = "default";
        }

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

        storage.ensureHostDirectory(host, function(err, hostDirectoryPath) {

            if (err) {
                callback(err);
                return;
            }

            var contentDirectoryPath = path.join(hostDirectoryPath, "content", repositoryId, branchId, nodeId, locale);

            fs.exists(contentDirectoryPath, function(exists) {

                if (!exists)
                {
                    mkdirp(contentDirectoryPath, function() {
                        callback(null, contentDirectoryPath);
                    });
                }
                else
                {
                    callback(null, contentDirectoryPath);
                }
            });
        });
    };

    /**
     * Ensures that the content deployment root directory for Cloud CMS assets.
     *
     * This directory looks like:
     *
     *   /hosts
     *      /<host>
     *          /data
     *              /<datastoreType>
     *                  /<datastoreId>
     *                      /<objectTypeId>
     *                          /<objectId>
     *                              /<localeKey>
     *                                  /attachments
     *                                      [attachmentId]
     *                                      [attachmentId].cache
     *
     * @param host
     * @param datastoreTypeId
     * @param datastoreId
     * @param objectTypeId
     * @param objectId
     * @param locale
     * @param callback
     *
     * @return {*}
     */
    var ensureAttachableDirectory = function(host, datastoreTypeId, datastoreId, objectTypeId, objectId, locale, callback)
    {
        if (!host) {
            host = "default";
        }

        storage.ensureHostDirectory(host, function(err, hostDirectoryPath) {

            if (err) {
                callback(err);
                return;
            }

            //console.log("hostDirectoryPath: " + hostDirectoryPath);
            //console.log("datastoreTypeId: " + datastoreTypeId);
            //console.log("datastoreId: " + datastoreId);
            //console.log("objectTypeId: " + objectTypeId);
            //console.log("objectId: " + objectId);
            //console.log("locale: " + locale);

            var contentDirectoryPath = path.join(hostDirectoryPath, "data", datastoreTypeId, datastoreId, objectTypeId, objectId, locale);

            fs.exists(contentDirectoryPath, function(exists) {

                if (!exists)
                {
                    mkdirp(contentDirectoryPath, function() {
                        callback(null, contentDirectoryPath);
                    });
                }
                else
                {
                    callback(null, contentDirectoryPath);
                }
            });
        });
    };

    /**
     * Reads an existing asset and cacheInfo (if exists).
     *
     * @param filePath
     * @param callback
     */
    var readFromDisk = function(filePath, callback)
    {
        // the cache file must exist on disk
        var cacheFilePath = filePath + ".cache";

        var cacheExists = fs.existsSync(cacheFilePath);
        var fileExists = fs.existsSync(filePath);

        // check if we're in a bad state
        var badState = false;
        var badMessage = null;

        if (!cacheExists && !fileExists)
        {
            // nothing found
            callback({
                "message": "Nothing cached on disk"
            });

            return;
        }

        // the cache file and asset file exist on disk
        // however...if the size of the asset is 0, then we blow away the file
        if (cacheExists && fileExists)
        {
            var stats = fs.statSync(filePath);
            if (!stats)
            {
                console.log("Cached file stats not determined, forcing reload");
                fileExists = false;
            }
            else
            {
                if (stats.size == 0)
                {
                    console.log("Cached file asset size is 0, forcing reload");
                    fileExists = false;
                }
            }
        }

        if (cacheExists && fileExists)
        {
            // there is something on disk and we should serve it back (if we can)
            var cacheInfoString = fs.readFileSync(cacheFilePath);
            var cacheInfo = null;
            try
            {
                cacheInfo = JSON.parse(cacheInfoString);
                if (isCacheInfoValid(cacheInfo))
                {
                    callback(null, cacheInfo);
                    return;
                }
                else
                {
                    // bad cache file
                    badState = true;
                    badMessage = "Cache file found but it was invalid"
                }
            }
            catch (e)
            {
                badState = true;
                badMessage = "Failed to parse cache file: " + cacheFilePath + ", forcing cleanup";
            }
        }

        // if we get this far, it's a bad state

        if (cacheExists && !fileExists)
        {
            badState = true;
            badMessage = "Cache found but file missing, forcing cleanup";
        }
        if (!cacheExists && fileExists)
        {
            badState = true;
            badMessage = "File found but cache file missing, forcing cleanup";
        }

        if (badState)
        {
            // force cleanup
            safeRemove(filePath);
            safeRemove(cacheFilePath);

            callback({
                "message": badMessage
            });

            return;
        }
    };

    var isCacheInfoValid = function(cacheInfo)
    {
        if (!cacheInfo)
        {
            return false;
        }

        // length must be represented
        if (typeof(cacheInfo.length) == "undefined")
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

    var safeRemove = function(filePath)
    {
        try { fs.unlinkSync(filePath); } catch (e) {}
    };

    /**
     * Downloads the asset from host:port/path and stores it on disk at filePath.
     *
     * @param host
     * @param port
     * @param uri
     * @param gitana driver instance
     * @param filePath
     * @param callback
     */
    var writeToDisk = function(host, port, uri, gitana, filePath, callback)
    {
        var dirPath = path.dirname(filePath);

        // mkdirs
        mkdirp(dirPath, function(err) {

            // was there an error creating the directory?
            if (err)
            {
                console.log("There was an error creating a directory: " + dirPath);
                console.log(err.message);
                callback(err);
                return;
            }

            var _refreshAccessTokenAndRetry = function(host, port, uri, gitana, filePath, dirPath, attemptCount, maxAttemptsAllowed, previousError, cb)
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
                        _writeToDisk(host, port, uri, gitana, filePath, dirPath, attemptCount + 1, maxAttemptsAllowed, previousError, cb)
                    }
                });
            };

            var _writeToDisk = function(host, port, uri, gitana, filePath, dirPath, attemptCount, maxAttemptsAllowed, previousError, cb)
            {
                if (attemptCount === maxAttemptsAllowed)
                {
                    cb({
                        "message": "Maximum number of connection attempts exceeded(" + maxAttemptsAllowed + ")",
                        "err": previousError
                    });

                    return;
                }

                var tempFilePath = path.join(dirPath, uuid.v4());
                var tempStream = fs.createWriteStream(tempFilePath);

                var cacheFilePath = filePath + ".cache";

                tempStream.on("open", function(fd) {

                    // headers
                    var headers = {};

                    // add "authorization" for OAuth2 bearer token
                    var headers2 = gitana.platform().getDriver().getHttpHeaders();
                    headers["Authorization"] = headers2["Authorization"];

                    var URL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT + uri;
                    var request = require("request");
                    request({
                        "method": "GET",
                        "url": URL,
                        "qs": {},
                        "headers": headers
                    }).on('response', function(response) {

                        if (response.statusCode >= 200 && response.statusCode <= 204) {

                            response.pipe(tempStream).on("close", function(err) {

                                if (err)
                                {
                                    safeRemove(tempFilePath);

                                    // some went wrong at disk io level?
                                    cb({
                                        "message": "Failed to download: " + JSON.stringify(err)
                                    });
                                }
                                else
                                {
                                    // the temp file should exist at this point
                                    if (fs.existsSync(tempFilePath))
                                    {
                                        // remove old things
                                        safeRemove(filePath);
                                        safeRemove(cacheFilePath);

                                        // move temp file to target name
                                        try
                                        {
                                            fs.renameSync(tempFilePath, filePath);
                                        }
                                        catch (e)
                                        {
                                            // failed to write data file, thus the whole thing is invalid
                                            // failed to write cache file, thus the whole thing is invalid
                                            safeRemove(cacheFilePath);
                                            safeRemove(filePath);
                                            cb({
                                                "message": "Failed to rename temp to data file: " + filePath
                                            });
                                            return;
                                        }

                                        // write cache file
                                        var cacheInfo = buildCacheInfo(response);
                                        if (cacheInfo)
                                        {
                                            fs.writeFileSync(cacheFilePath, JSON.stringify(cacheInfo, null, "    "));
                                        }
                                        else
                                        {
                                            // failed to write cache file, thus the whole thing is invalid
                                            safeRemove(cacheFilePath);
                                            safeRemove(filePath);
                                            cb({
                                                "message": "Failed to write cache file: " + cacheFilePath
                                            });
                                            return;
                                        }

                                        cb(null, filePath, cacheInfo);
                                    }
                                    else
                                    {
                                        // for some reason, temp file wasn't found
                                        cb({
                                            "message": "Temp file not found: " + tempFilePath
                                        });
                                    }
                                }

                            }).on("error", function(err) {
                                console.log("Pipe error: " + err);
                            });
                        }
                        else
                        {
                            // some kind of http error (usually permission denied or invalid_token)

                            var body = "";

                            response.on('data', function (chunk) {
                                body += chunk;
                            });

                            response.on('end', function(){

                                // not found or error, make sure temp file removed from disk
                                if (fs.existsSync(tempFilePath))
                                {
                                    fs.unlinkSync(tempFilePath);
                                }

                                // see if it is "invalid_token"
                                // if so, we can automatically retry
                                var isInvalidToken = false;
                                try
                                {
                                    var json = JSON.parse(body);
                                    if (json && json.error == "invalid_token")
                                    {
                                        isInvalidToken = true;
                                    }
                                }
                                catch (e)
                                {
                                }

                                if (isInvalidToken)
                                {
                                    // fire for retry
                                    _refreshAccessTokenAndRetry(host, port, uri, gitana, filePath, dirPath, attemptCount, maxAttemptsAllowed, {
                                        "message": "Unable to load asset from remote store",
                                        "code": response.statusCode,
                                        "body": body
                                    }, cb);

                                    return;
                                }

                                // otherwise, it's not worth retrying at this time
                                cb({ "message": "Unable to load asset from remote store", "code": response.statusCode, "body": body });
                            });

                        }

                    }).on('error', function(e){
                        console.log("_writeToDisk request timed out");
                        console.log(e)
                    }).end();
                });

                tempStream.on("error", function(e) {
                    console.log("Temp stream errored out");
                    console.log(e);
                });

            };

            _writeToDisk(host, port, uri, gitana, filePath, dirPath, 0, 2, null, callback);
        });
    };

    /**
     * Downloads node metadata or an attachment and saves it to disk.
     *
     * @param host
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
    var downloadNode = function(host, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback)
    {
        // base storage directory
        ensureContentDirectory(host, repositoryId, branchId, nodeId, locale, function(err, contentDirectoryPath) {

            if (err) {
                callback(err);
                return;
            }

            var filePath = contentDirectoryPath;
            if (nodePath) {
                filePath = path.join(filePath, "paths", nodePath);
            }
            if (attachmentId) {
                filePath = path.join(filePath, "attachments", attachmentId);
            } else {
                filePath = path.join(filePath, "metadata.json");
            }

            // if force reload, delete from disk if exist
            if (forceReload) {
                try { fs.unlinkSync(filePath); } catch (e) { }
            }

            // if the cached asset is on disk, we serve it back
            readFromDisk(filePath, function(err, cacheInfo) {

                if (!err)
                {
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
                uri += "?a=true"
                if (nodePath) {
                    uri += "&path=" + nodePath;
                }

                var gitanaHost = process.env.GITANA_PROXY_HOST;// || "localhost";
                var gitanaPort = process.env.GITANA_PROXY_PORT;// || 8080;

                // console.log(uri);

                // grab from Cloud CMS and write to disk
                writeToDisk(gitanaHost, gitanaPort, uri, gitana, filePath, function(err, filePath, cacheInfo) {

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
        });
    };

    /**
     * Downloads a preview image for a node.
     *
     * @param host
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
    var previewNode = function(host, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        // base storage directory
        ensureContentDirectory(host, repositoryId, branchId, nodeId, locale, function(err, contentDirectoryPath) {

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

            var filePath = path.join(contentDirectoryPath, "previews", previewId);

            // if force reload, delete from disk if exist
            if (forceReload && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // if the cached asset is on disk, we serve it back
            readFromDisk(filePath, function(err, cacheInfo) {

                if (!err)
                {
                    callback(null, filePath, cacheInfo);
                    return;
                }

                // either there was an error (in which case things were cleaned up)
                // or there was nothing on disk

                var uri = "/repositories/" + repositoryId + "/branches/" + branchId + "/nodes/" + nodeId + "/preview/" + previewId;
                // force content disposition information to come back
                uri += "?a=true"
                if (nodePath)
                {
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

                var gitanaHost = process.env.GITANA_PROXY_HOST; // || "localhost";
                var gitanaPort = process.env.GITANA_PROXY_PORT; // || 8080;

                //console.log("PREVIEW HOST: " + gitanaHost);
                //console.log("PREVIEW PORT: " + gitanaPort);
                //console.log("PREVIEW URL: " + uri);

                writeToDisk(gitanaHost, gitanaPort, uri, gitana, filePath, function(err, filePath, responseHeaders) {

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
        });
    };

    /**
     * Downloads attachable metadata or an attachment and saves it to disk.
     *
     * @param host
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
    var downloadAttachable = function(host, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, forceReload, callback)
    {
        // base storage directory
        ensureAttachableDirectory(host, datastoreTypeId, datastoreId, objectTypeId, objectId, locale, function(err, dataDirectoryPath) {

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

            // if force reload, delete from disk if exist
            if (forceReload) {
                try { fs.unlinkSync(filePath); } catch (e) { }
            }

            // if the cached asset is on disk, we serve it back
            readFromDisk(filePath, function(err, cacheInfo) {

                if (!err)
                {
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
                uri += "?a=true"

                var gitanaHost = process.env.GITANA_PROXY_HOST;
                var gitanaPort = process.env.GITANA_PROXY_PORT;

                //console.log(uri);

                // grab from Cloud CMS and write to disk
                writeToDisk(gitanaHost, gitanaPort, uri, gitana, filePath, function(err, filePath, cacheInfo) {

                    if (err) {
                        callback(err);
                    }
                    else {
                        callback(null, filePath, cacheInfo);
                    }
                });
            });
        });
    };

    /**
     * Downloads a preview image for an attachable.
     *
     * @param host
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
    var previewAttachable = function(host, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        // base storage directory
        ensureAttachableDirectory(host, datastoreTypeId, datastoreId, objectTypeId, objectId, locale, function(err, dataDirectoryPath) {

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

            // if force reload, delete from disk if exist
            if (forceReload && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // if the cached asset is on disk, we serve it back
            readFromDisk(filePath, function(err, cacheInfo) {

                if (!err)
                {
                    callback(null, filePath, cacheInfo);
                    return;
                }

                // either there was an error (in which case things were cleaned up)
                // or there was nothing on disk

                // begin constructing a URI
                var uri = generateURL(datastoreTypeId, datastoreId, objectTypeId, objectId, previewId);
                uri += "?a=true"
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

                var gitanaHost = process.env.GITANA_PROXY_HOST;
                var gitanaPort = process.env.GITANA_PROXY_PORT;

                writeToDisk(gitanaHost, gitanaPort, uri, gitana, filePath, function(err, filePath, responseHeaders) {

                    if (err) {
                        callback(err);
                    }
                    else {
                        callback(null, filePath, responseHeaders);
                    }
                });
            });
        });
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.determineBranchId = function(req) {

        var branchId = "master";

        if (req.branchId) {
            branchId = req.branchId;
        }

        return branchId;
    };

    r.download = function(host, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback)
    {
        downloadNode(host, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback);
    };

    r.preview = function(host, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        previewNode(host, gitana, repositoryId, branchId, nodeId, nodePath, attachmentId, locale, previewId, size, mimetype, forceReload, callback);
    };

    r.downloadAttachable = function(host, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, forceReload, callback)
    {
        downloadAttachable(host, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, forceReload, callback);
    };

    r.previewAttachable = function(host, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, previewId, size, mimetype, forceReload, callback)
    {
        previewAttachable(host, gitana, datastoreTypeId, datastoreId, objectTypeId, objectId, attachmentId, locale, previewId, size, mimetype, forceReload, callback);
    };

    return r;
};

