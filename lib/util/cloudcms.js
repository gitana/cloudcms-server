var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("util");

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
     * @param callback
     */
    var saveToDisk = function(host, port, uri, gitana, filePath, callback)
    {
        // mkdirs
        var dirPath = filePath;
        var x = filePath.lastIndexOf("/");
        if (x > -1)
        {
            dirPath = filePath.substring(0, x);
        }

        mkdirp(dirPath, function(err) {

            var tempFilePath = filePath + "." + new Date().getTime();
            var tempStream = fs.createWriteStream(tempFilePath);
            tempStream.on("open", function(fd) {

                //var headers = req.headers;
                var headers = {};

                // add "authorization"
                var headers2 = gitana.platform().getDriver().getHttpHeaders();
                headers["Authorization"] = headers2["Authorization"];

                var options = {
                    host:   host,
                    port:   port,
                    path:   uri,
                    method: 'GET',
                    headers: headers
                };

                //console.log("H: " + JSON.stringify(options, null, "  "));

                http.request(options, function(cres) {

                    if (cres.statusCode >= 200 && cres.statusCode <= 204) {

                        var r = cres.pipe(tempStream);
                        r.on('close', function(err) {
                            if (err) {
                                fs.unlinkSync(tempFilePath);
                            } else {

                                // remove old if exists
                                try { fs.unlinkSync(filePath); } catch (e) {}

                                // move temp file to target name
                                fs.renameSync(tempFilePath, filePath);

                                callback();
                            }
                        });

                    }
                    else
                    {
                        // not found or error, make sure temp file removed from disk
                        if (fs.existsSync(tempFilePath))
                        {
                            fs.unlinkSync(tempFilePath);
                        }

                        callback({ "message": "Unable to load asset from remote store", "code": cres.statusCode });
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
     * @param offsetPath
     * @param locale
     * @param forceReload
     * @param callback
     */
    var download = function(host, gitana, repositoryId, branchId, nodeId, attachmentId, offsetPath, locale, forceReload, callback)
    {
        // base storage directory
        ensureContentDirectory(host, repositoryId, branchId, nodeId, locale, function(err, contentDirectoryPath) {

            var filePath = path.join(contentDirectoryPath, offsetPath);
            if (attachmentId) {
                filePath = path.join(contentDirectoryPath, "attachments", attachmentId + path.extname(offsetPath));
            } else {
                filePath = path.join(contentDirectoryPath, "metadata.json");
            }

            // if force reload, delete from disk if exist
            if (forceReload && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            if (fs.existsSync(filePath)) {
                callback(filePath);
            }
            else
            {
                var assetPath = "/repositories/" + repositoryId + "/branches/" + branchId + "/nodes/" + nodeId;
                if (attachmentId) {
                    assetPath += "/attachments/" + attachmentId;
                }
                assetPath += "?path=" + offsetPath;

                var gitanaHost = process.env.GITANA_PROXY_HOST;// || "localhost";
                var gitanaPort = process.env.GITANA_PROXY_PORT;// || 8080;

                saveToDisk(gitanaHost, gitanaPort, assetPath, gitana, filePath, function(err) {
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

    r.download = function(host, gitana, repositoryId, branchId, nodeId, attachmentId, offsetPath, locale, forceReload, callback)
    {
        download(host, gitana, repositoryId, branchId, nodeId, attachmentId, offsetPath, locale, forceReload, callback);
    };

    r.determineBranchId = function(req) {

        var branchId = "master";

        if (req.branchId) {
            branchId = req.branchId;
        }

        return branchId;
    };

    return r;
};

