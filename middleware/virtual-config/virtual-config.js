var path = require('path');
var http = require('http');
var request = require('request');
var util = require("../../util/util");

/**
 * Retrieves virtual driver configuration for hosts from Cloud CMS.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
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

    var loadConfigForVirtualHost = function(host, logMethod, callback)
    {
        var configuration = process.configuration;

        if (configuration.virtualDriver && configuration.virtualDriver.enabled)
        {
            connectAsVirtualDriver(function(err, gitana) {

                if (err)
                {
                    //console.log("Unable to find virtual driver gitana instance for host: " + host);
                    //console.log(JSON.stringify(err, null, "   "));
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

                    //console.log("BODY: " + body);

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
        rootStore.existsFile("gitana.json", function(exists) {

            var loadFromRemote = function() {

                var CACHE_KEY = "vcSentinelFailed-" + host;

                // check cache to see if we already tried to load this in the past few minutes and were sorely disappointed
                process.cache.read(CACHE_KEY, function (err, failedRecently) {

                    if (failedRecently) {
                        callback({
                            "message": "No virtual config found for host (from previous attempt)"
                        });
                        return;
                    }

                    // load the gitana.json file from Cloud CMS
                    loadConfigForVirtualHost(host, logMethod, function (err, virtualConfig) {

                        if (err)
                        {
                            // something failed, perhaps a network issue
                            // don't store anything
                            callback(err);
                            return;
                        }

                        if (!virtualConfig)
                        {
                            // mark that it failed
                            process.cache.write(CACHE_KEY, "true", 120, function() {
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
                        var URL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT;
                        gitanaJson.baseURL = URL;

                        // mark as retrieved from virtual driver
                        gitanaJson._virtual = true;

                        // write the gitana.json file
                        rootStore.writeFile("gitana.json", JSON.stringify(gitanaJson, null, "   "), function (err) {
                            callback(err, gitanaJson);
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
                        callback(err);
                        return;
                    }

                    var gitanaJson = JSON.parse(data.toString());

                    // sanity check - is this for the right environment?
                    if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
                    {
                        // we're in production mode

                        var baseURL = gitanaJson.baseURL;
                        if (baseURL && baseURL.indexOf("localhost") > -1)
                        {
                            // bad - kill it off and then load from remote
                            rootStore.deleteFile("gitana.json", function() {
                                loadFromRemote();
                            });
                            return;
                        }
                    }
                    else
                    {
                        // we're in dev mode

                        /*
                        var baseURL = gitanaJson.baseURL;
                        if (baseURL && baseURL.indexOf("localhost") === -1)
                        {
                            // bad - kill it off and then load from remote
                            rootStore.deleteFile("gitana.json", function() {
                                loadFromRemote();
                            });
                            return;
                        }
                        */
                    }

                    // otherwise, fine!
                    callback(null, gitanaJson);

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
                next();
                return;
            }

            // defaults
            if (!configuration.baseURL) {
                configuration.baseURL = process.env.GITANA_PROXY_SCHEME + "://" + process.env.GITANA_PROXY_HOST + ":" + process.env.GITANA_PROXY_PORT;
            }
            if (!configuration.key) {
                configuration.key = "virtual";
            }

            var completionFunction = function (err, gitanaConfig) {
                if (err) {
                    if (err.message) {
                        req.log(err.message);
                    }
                    next();
                    return;
                }

                if (gitanaConfig) {
                    // store config
                    req.gitanaConfig = gitanaConfig;

                    // remember that we found this stuff virtually
                    req.gitanaLocal = false;
                }

                next();
            };

            process.driverConfigCache.read(req.domainHost, function(err, cachedValue)
            {

                if (cachedValue)
                {
                    if (cachedValue === "null")
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
                    acquireGitanaJson(req.domainHost, req.rootStore, req.log, function (err, gitanaConfig)
                    {

                        if (err)
                        {
                            completionFunction(err);
                            return;
                        }

                        if (gitanaConfig)
                        {
                            process.driverConfigCache.write(req.domainHost, {
                                "config": gitanaConfig
                            }, function (err)
                            {
                                completionFunction(null, gitanaConfig);
                            });
                        }
                        else
                        {
                            // mark with sentinel
                            process.driverConfigCache.write(req.domainHost, "null", function (err)
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

