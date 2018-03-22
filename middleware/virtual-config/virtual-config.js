var path = require('path');
var http = require('http');
var request = require('request');
var util = require("../../util/util");
var legacy = require("../../util/legacy");

/**
 * Retrieves virtual driver configuration for hosts from Cloud CMS.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var SENTINEL_NOT_FOUND_VALUE = "null";

    var connectAsVirtualDriver = function(callback)
    {
        var configuration = process.configuration;

        if (configuration.virtualDriver && configuration.virtualDriver.enabled)
        {
            if (process.env.CLOUDCMS_VIRTUAL_DRIVER_BASE_URL)
            {
                configuration.virtualDriver.baseURL = process.env.CLOUDCMS_VIRTUAL_DRIVER_BASE_URL;
            }

            // either connect anew or re-use an existing connection to Cloud CMS for this application
            Gitana.connect(configuration.virtualDriver, function(err) {

                if (err)
                {
                    return callback(err);
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

    var loadConfigForVirtualHost = function(host, logMethod, callback)
    {
        var configuration = process.configuration;

        if (configuration.virtualDriver && configuration.virtualDriver.enabled)
        {
            connectAsVirtualDriver(function(err, gitana) {

                if (err)
                {
                    return callback(err);
                }

                // no appkey, cannot load
                if (!configuration.virtualDriver.appKey)
                {
                    return callback();
                }

                // Basic Authentication request back to server
                var qs = {};
                qs.h = host;
                qs.a = configuration.virtualDriver.appKey;

                if (configuration.virtualDriver && configuration.virtualDriver.webhost)
                {
                    qs.w = configuration.virtualDriver.webhost;
                }

                var URL = configuration.virtualDriver.baseURL;
                if (!URL) {
                    URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT);
                }
                URL += "/virtual/driver/config";
                var requestConfig = {
                    "url": URL,
                    "qs": qs
                };

                util.retryGitanaRequest(logMethod, gitana, requestConfig, 2, function(err, response, body) {

                    if (response && response.statusCode === 200 && body)
                    {
                        var config = JSON.parse(body).config;
                        if (!config)
                        {
                            // nothing found
                            callback();
                        }
                        else
                        {
                            // make sure we update baseURL
                            config.baseURL = configuration.virtualDriver.baseURL;

                            // hand back
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


    var r = {};

    /**
     * Hands back the gitana.json file (JSON contents and file path) for a given virtual host.
     *
     * @type {Function}
     */
    var acquireGitanaJson = r.acquireGitanaJson = function(host, rootStore, logMethod, callback)
    {
        var VCSENTINEL_CACHE_KEY = "vcSentinelFailed-" + host;

        rootStore.existsFile("gitana.json", function(exists) {

            var loadFromRemote = function() {

                // check cache to see if we already tried to load this in the past few minutes and were sorely disappointed
                process.cache.read(VCSENTINEL_CACHE_KEY, function (err, failedRecently) {

                    if (failedRecently) {
                        return callback({
                            "message": "No virtual config found for host (from previous attempt)"
                        });
                    }

                    // load the gitana.json file from Cloud CMS
                    loadConfigForVirtualHost(host, logMethod, function (err, virtualConfig) {

                        if (err)
                        {
                            // something failed, perhaps a network issue
                            // don't store anything
                            return callback(err);
                        }

                        if (!virtualConfig)
                        {
                            // mark that it failed (5 seconds TTL)
                            process.cache.write(VCSENTINEL_CACHE_KEY, SENTINEL_NOT_FOUND_VALUE, 5, function() {
                                callback({
                                    "message": "No virtual config found for host"
                                });
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
                        if (virtualConfig.baseURL) {
                            gitanaJson.baseURL = virtualConfig.baseURL;
                        }
                        if (!gitanaJson.baseURL)
                        {
                            gitanaJson.baseURL = util.cleanupURL(util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT));
                        }

                        // mark as retrieved from virtual driver
                        gitanaJson._virtual = true;

                        // write the gitana.json file
                        rootStore.writeFile("gitana.json", JSON.stringify(gitanaJson, null, "   "), function (err) {

                            // if we failed to write the file, then delete and call back with error
                            if (err)
                            {
                                return rootStore.deleteFile("gitana.json", function() {
                                    callback(err);
                                });
                            }

                            // make sure the file wrote successfully
                            // check stats, ensure non-error and file size > 0
                            rootStore.fileStats("gitana.json", function(err, stats) {

                                // if we failed to read stats, then delete and call back with error
                                if (err || stats.size === 0)
                                {
                                    return rootStore.deleteFile("gitana.json", function() {
                                        callback({
                                            "message": "There was a problem writing the driver configuration file.  Please reload."
                                        });
                                    });
                                }

                                callback(null, gitanaJson);
                            });
                        });
                    });
                });
            };

            if (exists)
            {
                // read gitana json and send back
                rootStore.readFile("gitana.json", function(err, data) {

                    if (err)
                    {
                        return callback(err);
                    }

                    // make sure not size 0
                    rootStore.fileStats("gitana.json", function(err, stats) {

                        if (err)
                        {
                            return callback(err);
                        }

                        // if we failed to read stats or file size 0, then delete and call back with error
                        if (err || stats.size === 0)
                        {
                            return rootStore.deleteFile("gitana.json", function() {
                                callback({
                                    "message": "There was a problem writing the driver configuration file.  Please reload."
                                });
                            });
                        }

                        // remove vcSentinel if it exists
                        process.cache.remove(VCSENTINEL_CACHE_KEY);

                        var gitanaJson = JSON.parse(data.toString());

                        // sanity check - is this for the right environment?
                        if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
                        {
                            // we're in production mode

                            var baseURL = gitanaJson.baseURL;
                            if (baseURL && baseURL.indexOf("localhost") > -1)
                            {
                                // bad - kill it off and then load from remote
                                return rootStore.deleteFile("gitana.json", function() {
                                    loadFromRemote();
                                });
                            }
                        }

                        // auto-upgrade the host?
                        if (gitanaJson.baseURL)
                        {
                            var newBaseURL = legacy.autoUpgrade(gitanaJson.baseURL, true);
                            newBaseURL = util.cleanupURL(newBaseURL);
                            if (newBaseURL !== gitanaJson.baseURL)
                            {
                                console.log("Auto-upgrade gitana.json from: " + gitanaJson.baseURL + ", to: " + newBaseURL);

                                gitanaJson.baseURL = newBaseURL;

                                // write the gitana.json file
                                rootStore.writeFile("gitana.json", JSON.stringify(gitanaJson, null, "   "), function (err) {
                                    // nada
                                });
                            }
                        }

                        // otherwise, fine!
                        callback(null, gitanaJson);
                    });
                });
            }
            else
            {
                loadFromRemote();
            }
        });
    };

    r.interceptor = function()
    {
        return util.createInterceptor("virtualDriver", function(req, res, next, stores, cache, configuration) {

            // safety check: if we're running locally, then we disable virtual hosts
            if (req.gitanaLocal) {
                console.log("Local gitana.json file found - disabling virtual hosts");
                configuration.virtualHost.enabled = false;
                return next();
            }

            // defaults
            if (!configuration.baseURL)
            {
                configuration.baseURL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT);
            }
            if (!configuration.key) {
                configuration.key = "virtual";
            }

            var completionFunction = function (err, gitanaConfig) {
                if (err) {
                    if (err.message) {
                        req.log(err.message);
                    }
                    return next();
                }

                if (gitanaConfig) {
                    // store config
                    req.gitanaConfig = gitanaConfig;

                    // remember that we found this stuff virtually
                    req.gitanaLocal = false;
                }

                next();
            };

            process.driverConfigCache.read(req.virtualHost, function(err, cachedValue)
            {
                if (process.env.NULL_DRIVER_CACHE === "true") {
                    cachedValue = null;
                }

                if (cachedValue)
                {
                    if (cachedValue === SENTINEL_NOT_FOUND_VALUE)
                    {
                        // null means there verifiably isn't anything on disk (null used as sentinel marker)
                        completionFunction();
                    }
                    else
                    {
                        // we have something in cache
                        completionFunction(null, cachedValue.config);
                    }
                }
                else
                {
                    // try to load from disk
                    acquireGitanaJson(req.virtualHost, req.rootStore, req.log, function (err, gitanaConfig)
                    {
                        if (err)
                        {
                            return completionFunction(err);
                        }

                        if (gitanaConfig)
                        {
                            process.driverConfigCache.write(req.virtualHost, {
                                "config": gitanaConfig
                            }, function (err) {
                                completionFunction(null, gitanaConfig);
                            });
                        }
                        else
                        {
                            // mark with sentinel
                            process.driverConfigCache.write(req.virtualHost, SENTINEL_NOT_FOUND_VALUE, 5, function (err)
                            {
                                completionFunction();
                            });
                        }
                    });
                }
            });
        });
    };

    return r;
}();

