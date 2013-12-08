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
        // collect all of the candidates
        var candidates = [];

        var showHeaders = function(req)
        {
            for (var k in req.headers)
            {
                console.log("HEADER: " + k + " = " + req.headers[k]);
            }
        };

        var p = function(candidates, text)
        {
            if (text)
            {
                var z = text.indexOf(",");
                if (z > -1)
                {
                    var array = text.split(",");
                    for (var i = 0; i < array.length; i++)
                    {
                        candidates.push(util.trim(array[i]));
                    }
                }
                else
                {
                    candidates.push(text);
                }
            }
        };

        // X-FORWARDED-HOST
        var xForwardedHost = null;
        if (req.header("X-Forwarded-Host")) {
            xForwardedHost = req.header("X-Forwarded-Host");
        }
        else if (req.header("x-forwarded-host")) {
            xForwardedHost = req.header("x-forwarded-host");
        }
        else if (req.header("X-FORWARDED-HOST")) {
            xForwardedHost = req.header("X-FORWARDED-HOST");
        }
        p(candidates, xForwardedHost);

        // CUSTOM HOST HEADER
        if (configuration.virtualHost && configuration.virtualHost.hostHeader)
        {
            var customHost = req.header[configuration.virtualHost.hostHeader];
            p(candidates, customHost);
        }

        // REQ.HOST
        p(candidates, req.host);

        // find the one that is "cloudcms.net"
        var host = null;
        for (var x = 0; x < candidates.length; x++)
        {
            if (candidates[x].indexOf(".cloudcms.net") > -1)
            {
                host = candidates[x];
                break;
            }
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
     * used in any capacity.  The host is stored on the request as "virtualHost".  The path to persisted files
     * on disk for this host is written as "virtualHostDirectoryPath".
     *
     * @returns {Function}
     */
    r.virtualHostInterceptor = function(configuration)
    {
        // safety check: if "gitana.json" exists in the current working directory, then we disable virtual hosts
        if (process.env.CLOUDCMS_GITANA_JSON_PATH)
        {
            if (fs.existsSync(process.env.CLOUDCMS_GITANA_JSON_PATH))
            {
                console.log("Local gitana.json file found - disabling virtual hosts");
                configuration.virtualHost.enabled = false;
            }
        }

        return function(req, res, next)
        {
            if (!isVirtualHostEnabled(configuration))
            {
                next();
                return;
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
     * This is the second interceptor to run. It looks at the domain name and checks to see if a descriptor is
     * located on disk for the associated virtual file persistence path.  If a descriptor is not available, then
     * this optionally does a lazy load from the Cloud CMS server.
     *
     * @returns {Function}
     */
    r.virtualDriverConfigInterceptor = function(configuration)
    {
        // defaults
        if (configuration && configuration.virtualDriver)
        {
            if (!configuration.virtualDriver.baseURL) {
                configuration.virtualDriver.baseURL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT;
            }
            if (!configuration.virtualDriver.key) {
                configuration.virtualDriver.key = "virtual";
            }
        }

        var loadVirtualDriverGitana = function(req, callback)
        {
            if (configuration.virtualDriver)
            {
                // either connect anew or re-use an existing connection to Cloud CMS for this application
                Gitana.connect(configuration.virtualDriver, function(err) {

                    if (err)
                    {
                        callback(err);
                        return;
                    }

                    callback(null, this);
                });
            }
            else
            {
                callback({
                    "message": "Cannot dynamically load virtual driver since no virtualDriver configuration block was provided"
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
                            // nothing found
                            callback();
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
                    // NO!!
                    // THIS MIGHT WORK FOR VIRTUAL CONFIGS BUT WHAT ABOUT DEPLOYED APPS?
                    /*
                    if (exists && req.param("invalidate"))
                    {
                        fs.unlinkSync(gitanaJsonPath);
                        exists = false;
                    }
                    */

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

                            if (!virtualConfig)
                            {
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
                        // we're inactive, virtual host not running
                        // send back a 404
                        res.send(404);
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

