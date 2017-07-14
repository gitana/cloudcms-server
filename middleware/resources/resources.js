var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");

var mime = require("mime");

var cloudcmsUtil = require("../../util/cloudcms");

/**
 * Resources controller.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var resolveFilename = function(req, filePath, cacheInfo, requestedFilename)
    {
        var filename = req.query.filename;
        if (!filename)
        {
            filename = requestedFilename;
        }
        if (!filename)
        {
            filename = cacheInfo.filename;
        }
        if (!filename)
        {
            // pick last from file path
            filename = path.basename(filePath);
        }

        // safety check - if for some reason, no filename, bail out
        if (!filename)
        {
            return null;
        }

        // if filename doesn't have an extension, we'll conjure one up
        var ext = path.extname(filename);
        if (!ext)
        {
            var mimetype = cacheInfo.mimetype;
            if (mimetype)
            {
                ext = mime.extension(mimetype);
                if (ext)
                {
                    filename += "." + ext;
                }
            }
        }

        return filename;
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Serves back resources.
     *
     * @param configuration
     * @return {Function}
     */
    r.handler = function()
    {
        // resources handler
        return util.createHandler("resources", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/res/") === 0)
                {
                    // identifier = nodeId
                    var identifier = req.url.substring(5);

                    req.branch(function(err, branch) {

                        var repositoryId = null;
                        var branchId = null;

                        if (!err && branch)
                        {
                            repositoryId = branch.getRepositoryId();
                            branchId = branch.getId();
                        }

                        // from cookie?
                        if (req.cookies["ONETEAM_REPOSITORY_ID"])
                        {
                            repositoryId = req.cookies["ONETEAM_REPOSITORY_ID"];
                        }
                        if (req.cookies["ONETEAM_BRANCH_ID"])
                        {
                            branchId = req.cookies["ONETEAM_BRANCH_ID"];
                        }

                        var contentStore = stores.content;
                        var locale = req.locale;
                        var nodeId = identifier;
                        var attachmentId = "default";
                        var nodePath = null;

                        // whether to set content disposition on response
                        var useContentDispositionResponse = false;
                        var a = req.query["a"];
                        if (a === "true") {
                            useContentDispositionResponse = true;
                        }
                        var filename = req.query["filename"];
                        if (filename) {
                            useContentDispositionResponse = true;
                        }

                        // download and serve
                        cloudcmsUtil.download(contentStore, req.gitana, repositoryId, branchId, nodeId, attachmentId, nodePath, locale, false, function(err, filePath, cacheInfo, releaseLock) {

                            // if the file was found on disk or was downloaded, then stream it back
                            if (!err && filePath && cacheInfo)
                            {
                                if (useContentDispositionResponse)
                                {
                                    var filename = resolveFilename(req, filePath, cacheInfo, requestedFilename);
                                    contentStore.downloadFile(res, filePath, filename, function(err) {

                                        // something went wrong while streaming the content back...
                                        if (err)
                                        {
                                            util.status(res, 503);
                                            res.send(err);
                                            res.end();
                                        }

                                        releaseLock();
                                    });
                                }
                                else
                                {
                                    util.applyDefaultContentTypeCaching(res, cacheInfo);

                                    contentStore.sendFile(res, filePath, cacheInfo, function(err) {

                                        if (err)
                                        {
                                            util.handleSendFileError(req, res, filePath, cacheInfo, req.log, err);
                                        }

                                        releaseLock();
                                    });
                                }
                            }
                            else
                            {
                                if (err && err.invalidateGitanaDriver)
                                {
                                    console.log("Found err.invalidateGitanaDriver2 true");
                                    if (req.gitanaConfig)
                                    {
                                        // at this point, our gitana driver's auth token was pronounced dead and we need to invalidate
                                        // to get a new one, so blow things away here
                                        // in terms of the current request, it is allowed to do the fallback
                                        // however the next request will go to the gitana.json and attempt to login
                                        // if that fails and virtual driver mode, then a new gitana.json will be pulled down
                                        if (req.gitanaConfig.key)
                                        {
                                            console.log("Disconnecting driver: " + req.gitanaConfig.key);
                                            try
                                            {
                                                Gitana.disconnect(req.gitanaConfig.key);
                                            }
                                            catch (e)
                                            {
                                            }
                                        }

                                        // remove from cache
                                        if (req.virtualHost)
                                        {
                                            console.log("Remove driver cache for virtual host: " + req.virtualHost);
                                            try
                                            {
                                                process.driverConfigCache.invalidate(req.virtualHost, function () {
                                                    // all done
                                                });
                                            }
                                            catch (e)
                                            {
                                            }
                                        }
                                    }
                                }

                                if (req.query["fallback"])
                                {
                                    // redirect to the fallback
                                    res.redirect(req.query["fallback"]);
                                }
                                else
                                {
                                    // otherwise, allow other handlers to process this request
                                    next();
                                }

                                releaseLock();
                            }

                        });

                    });

                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }

        });
    };

    return r;
}();