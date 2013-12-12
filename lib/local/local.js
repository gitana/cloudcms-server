var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../util/util");

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Supports virtual hosts for locally deployed/published assets.
     * Files are served from:
     *
     *   /hosts
     *     /abc.cloudcms.net
     *       /public
     *
     * @return {Function}
     */
    r.virtualHandler = function()
    {
        return function(req, res, next)
        {
            if (req.virtualFiles)
            {
                var host = req.virtualHost;
                //var locale = localeUtil.determineLocale(req);

                // check whether there is a file matching this uri
                var uri = req.path;
                if ("/" === uri) {
                    uri = "/index.html";
                }

                var hostDirectoryPath = storage.hostDirectoryPath(host);

                var localDirectoryPath = path.join(hostDirectoryPath, "public");
                if (fs.existsSync(path.join(hostDirectoryPath, "public_build")))
                {
                    // does public_build have content?
                    var filenames = fs.readdirSync(path.join(hostDirectoryPath, "public_build"));
                    if (filenames && filenames.length > 0)
                    {
                        localDirectoryPath = path.join(hostDirectoryPath, "public_build");
                    }
                }

                fs.exists(localDirectoryPath, function(exists) {

                    if (exists)
                    {
                        util.sendFile(res, uri, {
                            "root": localDirectoryPath
                        }, function(err) {

                            if (err) {
                                next();
                            }

                        });
                    }
                    else
                    {
                        // allow another handler to handle the request
                        next();
                    }
                });
            }
            else
            {
                next();
            }
        };
    };

    /**
     * Fallback content retrieval for typical web paths.
     * Used during development and testing.
     *
     * @return {Function}
     */
    r.defaultHandler = function()
    {
        return function(req, res, next)
        {
            // check whether there is a file matching this uri
            var uri = req.path;
            if ("/" === uri) {
                uri = "/index.html";
            }

            var rootPath =  process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH;
            if (rootPath)
            {
                var resourceFilePath = path.join(rootPath, uri);
                fs.exists(resourceFilePath, function(exists) {

                    if (exists)
                    {
                        util.sendFile(res, uri, {
                            "root": rootPath
                        }, function(err) {

                            // some kind of IO issue streaming back
                            res.send(503, err);
                            res.end();
                        });
                    }
                    else
                    {
                        next();
                    }
                });
            }
            else
            {
                next();
            }
        };
    };

    return r;
};





