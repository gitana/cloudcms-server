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
     * Downloads the asset from host:port/path and stores it on disk at filePath.
     *
     * @param host
     * @param port
     * @param uri
     * @param gitana driver instance
     * @param filePath
     * @param autoRemove whether to auto clean up the file (i.e. non-persistent)
     * @param callback
     */
    var writeToDisk = function(host, port, uri, gitana, filePath, autoRemove, callback)
    {
        // mkdirs
        var dirPath = path.dirname(filePath);

        mkdirp(dirPath, function(err) {

            // was there an error creating the directory?
            if (err)
            {
                console.log("There was an error creating a directory: " + dirPath);
                console.log(err.message);
                callback(err);
                return;
            }

            var tempFilePath = filePath + "." + uuid.v4();
            var tempStream = fs.createWriteStream(tempFilePath);

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

                            if (err || autoRemove) {
                                fs.unlinkSync(tempFilePath);
                            } else {

                                // the temp file should exist at this point
                                if (fs.existsSync(tempFilePath))
                                {
                                    // remove old if exists
                                    try { fs.unlinkSync(filePath); } catch (e) {}

                                    // move temp file to target name
                                    fs.renameSync(tempFilePath, filePath);
                                }
                            }

                            callback();

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
                filePath = path.join(filePath, "attachments", attachmentId + path.extname(nodePath));
            } else {
                filePath = path.join(filePath, "metadata.json");
            }

            // if force reload, delete from disk if exist
            if (forceReload && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            if (fs.existsSync(filePath)) {
                callback(null, filePath);
            }
            else
            {
                var assetPath = "/repositories/" + repositoryId + "/branches/" + branchId + "/nodes/" + nodeId;
                if (attachmentId) {
                    assetPath += "/attachments/" + attachmentId;
                }
                if (nodePath) {
                    assetPath += "?path=" + nodePath;
                }

                var gitanaHost = process.env.GITANA_PROXY_HOST;// || "localhost";
                var gitanaPort = process.env.GITANA_PROXY_PORT;// || 8080;

                writeToDisk(gitanaHost, gitanaPort, assetPath, gitana, filePath, false, function(err) {
                    if (err) {
                        console.log("ERR: " + err.message + ", BODY: " + err.body);
                        callback(err);
                    }
                    else {
                        //console.log("Fetched: " + assetPath);
                        //console.log("Retrieved from server: " + filePath);
                        callback(null, filePath);
                    }
                });
            }
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
                uri += "?a=1";
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

                writeToDisk(gitanaHost, gitanaPort, uri, gitana, filePath, false, function(err) {
                    if (err) {
                        console.log("ERR: " + err.message);
                        callback(err);
                    }
                    else {
                        //console.log("Fetched: " + assetPath);
                        //console.log("Retrieved from server: " + filePath);
                        callback(null, filePath);
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

