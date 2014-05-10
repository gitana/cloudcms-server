var path = require('path');
var fs = require('fs');
var http = require('http');
var request = require('request');
var util = require("../../util/util");
var hosts = require("../../util/hosts");
var Gitana = require("gitana");

var DESCRIPTOR_CACHE = require("../../cache/descriptors");
var GITANA_DRIVER_CONFIG_CACHE = require("../../cache/driverconfigs");


/**
 * Virtual middleware.
 *
 * Provides virtualized host resolution and driver configuration retriever from the Cloud CMS server based on the
 * incoming host name.  Sets up request flags to inform any other middleware of locations on disk to find
 * virtualized assets.
 *
 * @type {Function}
 */
exports = module.exports = function(basePath)
{
    var storage = require("../../util/storage")(basePath);

    var connectAsVirtualDriver = function(callback)
    {
        var configuration = process.configuration;

        if (configuration.virtualDriver && configuration.virtualDriver.enabled)
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

    var isVirtualHostEnabled = function()
    {
        var configuration = process.configuration;

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

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.interceptors = function(app, configuration)
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

        if (!isVirtualHostEnabled(configuration))
        {
            return;
        }

        // defaults
        if (!configuration.virtualDriver.baseURL) {
            configuration.virtualDriver.baseURL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT;
        }
        if (!configuration.virtualDriver.key) {
            configuration.virtualDriver.key = "virtual";
        }

        // determine "req.virtualHost"
        app.use(virtualHostInterceptor(configuration));

        // if using virtual driver configs, the config is loaded from Cloud CMS for the virtual host
        // and written to disk
        // this overwrites "req.gitanaConfig" with virtual config and "req.gitanaJsonPath" with path to file
        app.use(virtualDriverConfigInterceptor(configuration));

        // if "descriptor.json" exists, write "req.descriptor" and "req.virtualFiles = true"
        app.use(virtualFilesInterceptor(configuration));
    };

    var loadConfigForVirtualHost = exports.loadConfigForVirtualHost = function(host, logMethod, callback)
    {
        var configuration = process.configuration;

        if (configuration.virtualDriver && configuration.virtualDriver.enabled)
        {
            connectAsVirtualDriver(function(err, gitana) {

                if (err)
                {
                    console.log("Unable to find virtual driver gitana instance for host: " + host);
                    console.log(JSON.stringify(err, null, "   "));
                    callback(err);
                    return;
                }

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
                var requestConfig = {
                    "url": URL,
                    "qs": qs
                };

                util.retryGitanaRequest(logMethod, gitana, requestConfig, 2, function(err, response, body) {

                    if (response && response.statusCode == 200 && body)
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
                        logMethod("Load virtual driver config failed");
                        if (response && response.statusCode)
                        {
                            logMethod("Response status code: " + response.statusCode);
                        }
                        if (err) {
                            logMethod("Err: " + JSON.stringify(err));
                        }
                        if (body) {
                            logMethod("Body: " + body);
                        }
                        var message = body;
                        if (!message) {
                            message = "Unable to load virtual driver configuration";
                        }
                        callback({
                            "message": message,
                            "err": err
                        });
                    }
                });
            });
        }
        else
        {
            callback();
        }
    };

    /**
     * Virtual Host interceptor.
     *
     * Determines the virtual host to use for the request.
     * Sets the "req.virtualHost" parameter.
     *
     * The latter describes the location on disk where files related to this host may be stored.  The location
     * may not yet exist on disk.
     *
     * @returns {Function}
     */
    var virtualHostInterceptor = function(configuration)
    {
        return function(req, res, next)
        {
            var host = hosts.determineHostForRequest(req);
            if (host)
            {
                req.virtualHost = host;

                next();
            }
            else
            {
                console.log("Unable to determine virtual host");
                next();
            }
        };
    };

    /**
     * Hands back the gitana.json file (JSON contents and file path) for a given virtual host.
     *
     * @type {Function}
     */
    var acquireGitanaJson = r.acquireGitanaJson = function(virtualHost, logMethod, callback)
    {
        var virtualHostDirectoryPath = storage.hostDirectoryPath(virtualHost);
        var gitanaJsonPath = path.join(virtualHostDirectoryPath, "gitana.json");

        // check for existence
        // if not exist, pull down from cloud cms server
        fs.exists(gitanaJsonPath, function(exists) {

            if (!exists)
            {
                // load the gitana.json file from Cloud CMS
                loadConfigForVirtualHost(virtualHost, logMethod, function(err, virtualConfig) {

                    if (err)
                    {
                        callback(err);
                        return;
                    }

                    if (!virtualConfig)
                    {
                        callback({
                            "message": "No virtual config found for host"
                        });
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

                    // mark as retrieved from virtual driver
                    gitanaJson._virtual = true;

                    // ensure the host directory exists
                    storage.ensureHostDirectory(virtualHost, function(err) {

                        if (err)
                        {
                            callback(err);
                            return;
                        }

                        // write gitana.json and return
                        fs.writeFile(gitanaJsonPath, JSON.stringify(gitanaJson, null, "   "), function(err) {
                            callback(err, gitanaJsonPath, gitanaJson);
                        });
                    });
                });
            }
            else
            {
                // read gitana json and send back
                fs.readFile(gitanaJsonPath, function(err, data) {

                    if (err)
                    {
                        callback(err);
                        return;
                    }

                    var gitanaJson = JSON.parse(data.toString());
                    callback(null, gitanaJsonPath, gitanaJson);

                });
            }
        });
    };

    /**
     * Virtual driver config interceptor.
     *
     * Loads the gitana driver.  Overwrites "req.gitanaConfig" and "req.gitanaJsonPath"
     *
     * @returns {Function}
     */
    var virtualDriverConfigInterceptor = function(configuration)
    {
        return function(req, res, next)
        {
            if (req.virtualHost)
            {
                var completionFunction = function(err, gitanaJsonPath, gitanaConfig)
                {
                    if (err)
                    {
                        req.log(err.message);
                        next();
                        return;
                    }

                    if (gitanaJsonPath && gitanaConfig)
                    {
                        // overwrite path to gitana.json file
                        req.gitanaJsonPath = gitanaJsonPath;
                        req.gitanaConfig = gitanaConfig;
                    }

                    next();
                };

                var cachedValue = GITANA_DRIVER_CONFIG_CACHE.read(req.virtualHost);
                if (cachedValue)
                {
                    if (cachedValue == "null")
                    {
                        // null means there verifiably isn't anything on disk (null used as sentinel marker)
                        completionFunction();
                    }
                    else
                    {
                        // we have something in cache
                        completionFunction(null, cachedValue.path, cachedValue.config);
                    }
                }
                else
                {
                    // try to load from disk
                    acquireGitanaJson(req.virtualHost, req.log, function(err, gitanaJsonPath, gitanaConfig) {

                        if (err)
                        {
                            completionFunction(err);
                            return;
                        }

                        if (gitanaJsonPath && gitanaConfig)
                        {
                            GITANA_DRIVER_CONFIG_CACHE.write(req.virtualHost, {
                                "path": gitanaJsonPath,
                                "config": gitanaConfig
                            });

                            completionFunction(null, gitanaJsonPath, gitanaConfig);
                        }
                        else
                        {
                            // mark with sentinel
                            GITANA_DRIVER_CONFIG_CACHE.write(req.virtualHost, "null");

                            completionFunction();
                        }
                    });
                }
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
     * It looks at the domain name (host) and figures out whether
     * to mount virtual files from disk.
     *
     * @returns {Function}
     */
    var virtualFilesInterceptor = function(configuration)
    {
        return function(req, res, next)
        {
            if (req.virtualHost)
            {
                var completionFunction = function(err, descriptor)
                {
                    if (err)
                    {
                        // something went wrong
                        next();
                        return;
                    }

                    if (!descriptor)
                    {
                        // nothing found
                        next();
                        return;
                    }

                    // yes, virtual host deployed, store a few interesting things on the request

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

                    // mark that we're able to handle virtual files
                    req.virtualFiles = true;

                    // continue middleware chain
                    next();
                };

                // CACHE: is there a cached descriptor for this host?
                // NOTE: null is a valid sentinel value (meaning none)
                var descriptor = DESCRIPTOR_CACHE.read(req.virtualHost);
                if (typeof(descriptor) !== "undefined" || descriptor === null)
                {
                    // all done
                    completionFunction(null, descriptor);
                    return;
                }
                else
                {
                    // nothing in cache, load from disk
                    // check if there is a descriptor on disk
                    var descriptorFilePath = path.join(storage.hostDirectoryPath(req.virtualHost), "descriptor.json");
                    fs.exists(descriptorFilePath, function(exists) {

                        if (exists)
                        {
                            // load the descriptor
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

                                // CACHE: write
                                DESCRIPTOR_CACHE.write(req.virtualHost, descriptor);

                                // all done
                                completionFunction(null, descriptor);
                            });
                        }
                        else
                        {
                            completionFunction();
                        }
                    });
                }
            }
            else
            {
                // skip
                next();
            }

        };
    };

    return r;
};

