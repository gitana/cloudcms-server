var path = require('path');
var fs = require('fs');
var util = require("util");
var uuid = require("node-uuid");

var mkdirp = require('mkdirp');

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);

    /**
     * Ensures that the content deployment root directory for Cloud CMS assets.
     *
     * This directory looks like:
     *
     *   /hosts
     *      /abc.cloudcms.net
     *          /cloudcms
     *              /<repositoryId>
     *                  /<branchId>
     *                      /<nodeId>
     *                          /<localeKey>
     *                              /content
     *
     * @param host
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
                                callback({
                                    "message": "Failed to download"
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
                                        callback({
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
                                        callback({
                                            "message": "Failed to write cache file: " + cacheFilePath
                                        });
                                        return;
                                    }

                                    callback(null, filePath, cacheInfo);
                                }
                                else
                                {
                                    // for some reason, temp file wasn't found
                                    callback({
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

                            callback({ "message": "Unable to load asset from remote store", "code": response.statusCode, "body": body });
                        });

                    }

                }).end();

            });

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
    var download = function(host, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback)
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
     * @param locale
     * @param previewId
     * @param size
     * @param forceReload
     * @param callback
     */
    var preview = function(host, gitana, repositoryId, branchId, nodeId, nodePath, locale, previewId, size, mimetype, forceReload, callback)
    {
        // base storage directory
        ensureContentDirectory(host, repositoryId, branchId, nodeId, locale, function(err, contentDirectoryPath) {

            if (err) {
                callback(err);
                return;
            }

            if (!previewId)
            {
                previewId = "_unknown";
                forceReload = true;
            }

            var filePath = path.join(contentDirectoryPath, "previews", previewId);

            // if force reload, delete from disk if exist
            if (forceReload && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            if (filePath && fs.existsSync(filePath)) {
                callback(null, filePath);
            }
            else
            {
                var uri = "/repositories/" + repositoryId + "/branches/" + branchId + "/nodes/" + nodeId + "/preview/" + previewId;
                // force content disposition information to come back
                uri += "?a=true"
                if (nodePath)
                {
                    uri += "&path=" + nodePath;
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

                var gitanaHost = process.env.GITANA_PROXY_HOST;// || "localhost";
                var gitanaPort = process.env.GITANA_PROXY_PORT;// || 8080;

                console.log("PREVIEW HOST: " + gitanaHost);
                console.log("PREVIEW PORT: " + gitanaPort);
                console.log("PREVIEW URL: " + uri);

                writeToDisk(gitanaHost, gitanaPort, uri, gitana, filePath, function(err, filePath, responseHeaders) {

                    if (err) {
                        console.log("ERR: " + err.message);
                        callback(err);
                    }
                    else {
                        //console.log("Fetched: " + assetPath);
                        //console.log("Retrieved from server: " + filePath);
                        callback(null, filePath, responseHeaders);
                    }
                });
            }
        });
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.download = function(host, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback)
    {
        download(host, gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, forceReload, callback);
    };

    r.determineBranchId = function(req) {

        var branchId = "master";

        if (req.branchId) {
            branchId = req.branchId;
        }

        return branchId;
    };

    r.preview = function(host, gitana, repositoryId, branchId, nodeId, nodePath, locale, previewId, size, mimetype, forceReload, callback)
    {
        preview(host, gitana, repositoryId, branchId, nodeId, nodePath, locale, previewId, size, mimetype, forceReload, callback);
    };

    return r;
};

