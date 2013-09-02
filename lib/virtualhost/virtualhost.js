var path = require('path');
var fs = require('fs');
var http = require('http');
var request = require('request');

var util = require("../util/util");

var Gitana = require("gitana");

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // try to determine the virtual host
    var determineHost = function(configuration, req)
    {
        var host = null;
        if (req.header("X-Forwarded-Host")) {
            host = req.header("X-Forwarded-Host");
        }

        if (!host && configuration.virtualHost.hostHeader)
        {
            host = req.host;
        }

        return host;
    };

    var isVirtualHostEnabled = function(configuration)
    {
        var enabled = false;

        if (configuration && configuration.virtualHost)
        {
            if (typeof(configuration.virtualHost.enabled) != "undefined")
            {
                enabled = configuration.virtualHost.enabled;
            }
        }

        return enabled;
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
    r.virtualHostInterceptor = function(configuration)
    {
        return function(req, res, next)
        {
            if (!isVirtualHostEnabled(configuration))
            {
                next();
                return;
            }

            // CORRECTION for some kind of bug in Express where URLs start with "//"???
            if (req.url.indexOf("//") == 0) {
                req.url = req.url.substring(1);
            }

            var host = determineHost(configuration, req);
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
    r.virtualDriverConfigInterceptor = function(configuration)
    {
        var loadVirtualDriverGitana = function(req, callback)
        {
            if (process.VIRTUAL_GITANA_DRIVER)
            {
                callback(null, process.VIRTUAL_GITANA_DRIVER);
            }
            else
            {
                var vConfig = {};
                if (configuration.virtualDriver) {
                    if (configuration.virtualDriver.clientKey) {
                        vConfig.clientKey = configuration.virtualDriver.clientKey;
                    }
                    if (configuration.virtualDriver.clientSecret) {
                        vConfig.clientSecret = configuration.virtualDriver.clientSecret;
                    }
                    if (configuration.virtualDriver.username) {
                        vConfig.username = configuration.virtualDriver.username;
                    }
                    if (configuration.virtualDriver.password) {
                        vConfig.password = configuration.virtualDriver.password;
                    }
                }
                vConfig.baseURL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT;

                // either connect anew or re-use an existing connection to Cloud CMS for this application
                Gitana.connect(vConfig, function(err) {

                    if (err)
                    {
                        callback(err);
                        return;
                    }

                    process.VIRTUAL_GITANA_DRIVER = this;

                    callback(null, this);
                });
            }
        };

        var loadVirtualDriverConfig = function(req, callback)
        {
            var host = req.virtualHost;

            loadVirtualDriverGitana(req, function(err, platform) {

                if (err)
                {
                    console.log("ERROR ON VIRTUAL DRIVER GITANA LOAD FOR HOST: " + host);
                    console.log(JSON.stringify(err, null, "   "));
                    callback(err);
                    return;
                }

                // using basic authentication over HTTPS, make a request to Cloud CMS and request the client to use for
                // the trusted domain for the given host

                // Basic Authentication request back to server
                var uri = "http://" + host;
                // as related above, this adjusts the URL
                if (configuration.virtualDriver && configuration.virtualDriver.appKey)
                {
                    uri += "/" + configuration.virtualDriver.appKey;
                }
                var URL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT + "/virtual/driver/config";
                var qs = {
                    "uri": uri
                };
                if (configuration.virtualDriver && configuration.virtualDriver.webhost)
                {
                    qs.w = configuration.virtualDriver.webhost;
                }
                var authorizationHeader = platform.getDriver().getHttpHeaders()["Authorization"];
                request({
                    "url": URL,
                    "qs": qs,
                    "headers": {
                        "Authorization": authorizationHeader
                    }
                }, function(err, response, body) {

                    if (response.statusCode == 200)
                    {
                        var config = JSON.parse(body).config;
                        if (!config)
                        {
                            callback({
                                "message": "Unable to find virtual configuration"
                            });
                        }
                        else
                        {
                            callback(null, config);
                        }
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
            });
        };

        return function(req, res, next)
        {
            if (!isVirtualHostEnabled(configuration))
            {
                next();
                return;
            }

            if (req.virtualHost)
            {
                var gitanaJsonPath = path.join(req.virtualHostDirectoryPath, "gitana.json");

                // check for existence
                // if not exist, pull down from cloud cms server
                fs.exists(gitanaJsonPath, function(exists) {

                    // if exists...
                    // if "invalidate" is in the req param, then kill file from disk
                    // this forces reload from server
                    if (exists && req.param("invalidate"))
                    {
                        fs.unlinkSync(gitanaJsonPath);
                        exists = false;
                    }

                    if (!exists)
                    {
                        // load the gitana.json file from Cloud CMS
                        loadVirtualDriverConfig(req, function(err, virtualConfig) {

                            if (err)
                            {
                                console.log("Error while loading virtual driver config for host: " + req.virtualHost);
                                console.log("  -> " + err.message);
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
                            var URL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT;
                            gitanaJson.baseURL = URL;

                            // write gitana.json
                            fs.writeFile(gitanaJsonPath, JSON.stringify(gitanaJson, null, "   "));

                            // store path to virtualized gitana.json file
                            req.virtualHostGitanaJsonPath = gitanaJsonPath;

                            next();
                        });
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
    r.virtualFilesInterceptor = function(configuration)
    {
        return function(req, res, next)
        {
            if (!isVirtualHostEnabled(configuration))
            {
                next();
                return;
            }

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

                    // write descriptor to request
                    req.descriptor = descriptor;

                    // first check to see if we're inactive
                    if (!descriptor.active)
                    {
                        // we're inactive, virtual host not deployed
                        next();
                        return;
                    }

                    // yes, virtual host deployed, store a few interesting things on the request

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

