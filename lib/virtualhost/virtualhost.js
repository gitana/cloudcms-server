var path = require('path');
var fs = require('fs');
var http = require('http');
var request = require('request');

var util = require("../util/util");

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // try to determine the virtual host
    var determineHost = function(req)
    {
        var host = null;
        if (req.header("X-Forwarded-Host")) {
            host = req.header("X-Forwarded-Host");
        }

        return host;
    };

    var r = {};

    /**
     * Virtual Host interceptor.
     *
     * This is the first interceptor to run.  It simply determines whether the virtual host mechanism should be
     * used in any capacity.  The host is stored on the request as "virtualHost".
     *
     * @returns {Function}
     */
    r.virtualHostInterceptor = function()
    {
        return function(req, res, next)
        {
            // CORRECTION for some kind of bug in Express where URLs start with "//"???
            if (req.url.indexOf("//") == 0) {
                req.url = req.url.substring(1);
            }

            var host = determineHost(req);
            if (host)
            {
                req.virtualHost = host;

                storage.ensureHostDirectory(req.virtualHost, function(err, virtualHostDirectoryPath) {

                    if (err)
                    {
                        console.log("Could not create virtual host directory path for host: " + req.virtualHost);
                        console.log(err);
                        next();
                        return;
                    }

                    // write the base host directory to req
                    req.virtualHostDirectoryPath = virtualHostDirectoryPath;

                    next();
                });
            }
            else
            {
                next();
            }
        };
    };

    /**
     * Virtual client interceptor.
     *
     * This interceptor runs first in the chain.  It looks at the domain name and checks to see if a descriptor is
     * located on disk for the associated virtual file persistence path.  If a descriptor is not available, then
     * this optionally does a lazy load from the Cloud CMS server.
     *
     * @returns {Function}
     */
    r.virtualDriverConfigInterceptor = function(config)
    {
        var loadVirtualDriverConfig = function(host, callback)
        {
            // using basic authentication over HTTPS, make a request to Cloud CMS and request the client to use for
            // the trusted domain for the given host

            // Basic Authentication request back to server
            var uri = "http://" + host;
            if (config && config.appKey)
            {
                uri += "/" + config.appKey;
            }
            request({
                "url": "http://localhost:8080/virtual/driver/config",
                "qs": {
                    "uri": uri
                },
                "auth": {
                    "user": "admin",
                    "pass": "admin",
                    "sendImmediately": true
                }
            }, function(err, response, body) {

                if (response.statusCode == 200)
                {
                    var config = JSON.parse(body).config;
                    callback(null, config);
                }
                else
                {
                    console.log("Error: " + response.statusCode);
                    console.log(body);
                    callback({
                        "message": body
                    });
                }
            });
        };

        return function(req, res, next)
        {
            if (req.virtualHost)
            {
                var gitanaJsonPath = path.join(req.virtualHostDirectoryPath, "gitana.json");
                fs.exists(gitanaJsonPath, function(exists) {

                    if (!exists)
                    {
                        if (config)
                        {
                            // load the gitana.json file from Cloud CMS
                            loadVirtualDriverConfig(req.virtualHost, function(err, virtualConfig) {

                                if (err)
                                {
                                    console.log("Error while loading trusted domain for host: " + req.virtualHost);
                                    console.log(err);
                                    next();
                                    return;
                                }

                                // populate gitana.json
                                var gitanaJson = {
                                    "clientKey": virtualConfig.clientKey
                                };
                                if (virtualConfig.clientSecret) {
                                    gitanaJson.clientSecret = virtualConfig.clientSecret;
                                }
                                if (virtualConfig.username) {
                                    gitanaJson.username = virtualConfig.username;
                                }
                                if (virtualConfig.password) {
                                    gitanaJson.password = virtualConfig.password;
                                }
                                if (virtualConfig.application) {
                                    gitanaJson.application = virtualConfig.application;
                                }
                                gitanaJson.baseURL = "http://localhost:8080";

                                // write gitana.json
                                fs.writeFile(gitanaJsonPath, JSON.stringify(gitanaJson, null, "   "));

                                // store path to virtualized gitana.json file
                                req.virtualHostGitanaJsonPath = gitanaJsonPath;

                                next();
                            });
                        }
                        else
                        {
                            next();
                        }
                    }
                    else
                    {
                        // store path to virtualized gitana.json file
                        req.virtualHostGitanaJsonPath = gitanaJsonPath;

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
     * Virtual files interceptor.
     *
     * This interceptor runs first in the chain.  It looks at the domain name (host) and figures out whether
     * to mount virtual files from disk.
     *
     * @returns {Function}
     */
    r.virtualFilesInterceptor = function()
    {
        return function(req, res, next)
        {
            if (req.virtualHost)
            {
                // load the descriptor
                var descriptorFilePath = path.join(storage.hostDirectoryPath(req.virtualHost), "descriptor.json");
                fs.readFile(descriptorFilePath, function(err, descriptor) {

                    if (err)
                    {
                        // no file descriptor, virtual files not deployed
                        next();
                        return;
                    }

                    // yes, there is a descriptor, so we have virtual files

                    // convert descriptor to JSON
                    descriptor = JSON.parse(descriptor);

                    // first check to see if we're inactive
                    if (!descriptor.active)
                    {
                        // we're inactive, virtual host not deployed
                        next();
                        return;
                    }

                    // yes, virtual host deployed, store a few interesting things on the request

                    // write descriptor to request
                    req.descriptor = descriptor;

                    // mark that we're able to handle virtual files
                    req.virtualFiles = true;

                    next();

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

