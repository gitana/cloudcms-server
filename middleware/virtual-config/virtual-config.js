var util = require("../../util/util");

var workQueueFactory = require("../../util/workqueue");

//var debugLog = process.debugLog;

/**
 * Retrieves virtual driver configuration for hosts from Cloud CMS.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    // ensures that we only load 2 virtual config at a time
    var enqueueLoadVirtualConfig = workQueueFactory(2);

    var SENTINEL_NOT_FOUND_VALUE = "null";
    var BLACKLIST_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

    var VIRTUAL_DRIVER_CACHE_KEY = "virtualdriver";

    var disconnectVirtualDriver = function()
    {
        Gitana.disconnect(VIRTUAL_DRIVER_CACHE_KEY);
    };

    var connectAsVirtualDriver = function(callback)
    {
        var configuration = process.configuration;

        if (configuration.virtualDriver && configuration.virtualDriver.enabled)
        {
            if (process.env.CLOUDCMS_VIRTUAL_DRIVER_BASE_URL)
            {
                configuration.virtualDriver.baseURL = process.env.CLOUDCMS_VIRTUAL_DRIVER_BASE_URL;
            }

            // force key to "virtualdriver"
            configuration.virtualDriver.key = VIRTUAL_DRIVER_CACHE_KEY;

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

        if (!configuration.virtualDriver || !configuration.virtualDriver.enabled)
        {
            return callback();
        }

        // no appkey, cannot load
        if (!configuration.virtualDriver.appKey)
        {
            return callback();
        }

        connectAsVirtualDriver(function(err, gitana) {

            if (err)
            {
                return callback(err);
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
                URL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH);
            }
            URL += "/virtual/driver/config";
            var requestConfig = {
                "url": URL,
                "qs": qs
            };

            util.retryGitanaRequest(logMethod, gitana, requestConfig, 2, function(err, response, body) {

                if (response && response.status === 200 && body)
                {
                    var config = body.config;
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
                    if (response && response.status)
                    {
                        logMethod("Response status code: " + response.status);
                    }
                    if (err) {
                        logMethod("Err: " + JSON.stringify(err));
                    }
                    if (body) {
                        logMethod("Body: " + body);
                    }
                    var message = null;
                    if (body) {
                        message = JSON.stringify(body);
                    }
                    if (!message) {
                        message = "Unable to load virtual driver configuration";
                    }

                    // force disconnect of virtual driver so that it has to log in again
                    // this prevents the attempt to use the refresh token
                    disconnectVirtualDriver();

                    // fire callback
                    callback({
                        "message": message,
                        "err": err
                    });
                }
            });
        });
    };

    var r = {};

    /**
     * Hands back the gitana.json file (JSON contents and file path) for a given virtual host.
     *
     * @type {Function}
     */
    var acquireGitanaJson = r.acquireGitanaJson = function(host, rootStore, logMethod, callback) {

        var VCSENTINEL_CACHE_KEY = "vcSentinelFailed-" + host;

        // so that only N number of virtual configs are loaded at a time
        var workFn = function(host, rootStore, logMethod) {

            return function(done)
            {
                rootStore.existsFile("gitana.json", function(exists) {

                    var loadFromRemote = function(finishedLoading) {

                        // check cache to see if we already tried to load this in the past few minutes and were sorely disappointed
                        process.cache.read(VCSENTINEL_CACHE_KEY, function (err, doesNotExist) {

                            if (doesNotExist) {
                                return finishedLoading({
                                    "message": "No virtual config found for host (from previous attempt)"
                                }, null, true);
                            }

                            // load the gitana.json file from Cloud CMS
                            loadConfigForVirtualHost(host, logMethod, function (err, virtualConfig) {

                                if (err)
                                {
                                    // something failed, perhaps a network issue
                                    // don't store anything
                                    return finishedLoading(err);
                                }

                                if (!virtualConfig)
                                {
                                    // mark that it failed (30 minute TTL)
                                    return process.cache.write(VCSENTINEL_CACHE_KEY, true, BLACKLIST_TTL_SECONDS, function() {
                                        finishedLoading({
                                            "message": "No virtual config found for host: " + host
                                        });
                                    });
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
                                    gitanaJson.baseURL = util.cleanupURL(util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH));
                                }

                                // mark as retrieved from virtual driver
                                gitanaJson._virtual = true;

                                // write the gitana.json file
                                rootStore.writeFile("gitana.json", JSON.stringify(gitanaJson, null, "   "), function (err) {

                                    // if we failed to write the file, then delete and call back with error
                                    if (err)
                                    {
                                        return rootStore.deleteFile("gitana.json", function() {
                                            finishedLoading(err);
                                        });
                                    }

                                    // make sure the file wrote successfully
                                    // check stats, ensure non-error and file size > 0
                                    rootStore.fileStats("gitana.json", function(err, stats) {

                                        // if we failed to read stats, then delete and call back with error
                                        if (err || stats.size === 0)
                                        {
                                            return rootStore.deleteFile("gitana.json", function() {
                                                finishedLoading({
                                                    "message": "There was a problem writing the driver configuration file.  Please reload."
                                                });
                                            });
                                        }

                                        finishedLoading(null, gitanaJson);
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
                                return done(err);
                            }

                            if (!data)
                            {
                                return done({
                                    "message": "The gitana.json data read from disk was null or empty"
                                })
                            }

                            // make sure not size 0
                            rootStore.fileStats("gitana.json", function(err, stats) {

                                if (err)
                                {
                                    return done(err);
                                }

                                // if we failed to read stats or file size 0, then delete and call back with error
                                if (err || stats.size === 0)
                                {
                                    return rootStore.deleteFile("gitana.json", function() {
                                        done({
                                            "message": "There was a problem writing the driver configuration file.  Please reload."
                                        });
                                    });
                                }

                                // remove vcSentinel if it exists
                                process.cache.remove(VCSENTINEL_CACHE_KEY);

                                var gitanaJson = JSON.parse("" + data);

                                // auto-upgrade the host?
                                if (gitanaJson.baseURL)
                                {
                                    var newBaseURL = util.cleanupURL(gitanaJson.baseURL);
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
                                done(null, gitanaJson);
                            });
                        });
                    }
                    else
                    {
                        loadFromRemote(function(err, gitanaJson, doesNotExist) {
                            done(err, gitanaJson, doesNotExist);
                        });
                    }
                });
            }

        }(host, rootStore, logMethod);

        enqueueLoadVirtualConfig(workFn, function(err, gitanaJson, doesNotExist) {
            callback(err, gitanaJson, doesNotExist);
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
                configuration.baseURL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT, process.env.GITANA_PROXY_PATH);
            }
            if (!configuration.key) {
                configuration.key = "virtual";
            }

            var completionFunction = function (err, gitanaConfig, doesNotExist)
            {
                if (doesNotExist)
                {
                    // console.log("BLOCK, method: " + req.method + ", url: " + req.url);
                    // if (req.headers)
                    // {
                    //     console.log(" -> headers: " + JSON.stringify(req.headers, null, 2));
                    // }
                    // if (req.query)
                    // {
                    //     console.log(" -> query: " + JSON.stringify(req.query, null, 2));
                    // }
                    //
                    // are we being spoofed? kill the connection
                    res.blocked = true;
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({"error": true, "message": "Bad Request."}));
                }

                if (err)
                {
                    if (err.message)
                    {
                        req.log(err.message);
                    }

                    return next();
                }

                if (gitanaConfig)
                {
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
                        completionFunction(null, null, true);
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
                    acquireGitanaJson(req.virtualHost, req.rootStore, req.log, function (err, gitanaConfig, doesNotExist)
                    {
                        if (err && !doesNotExist)
                        {
                            return completionFunction(err);
                        }

                        if (gitanaConfig)
                        {
                            return process.driverConfigCache.write(req.virtualHost, {
                                "config": gitanaConfig
                            }, function (err) {
                                completionFunction(err, gitanaConfig);
                            });
                        }

                        // mark with sentinel (30 minutes)
                        req.log("[BLACKLIST] Adding: " + req.virtualHost);
                        process.driverConfigCache.write(req.virtualHost, SENTINEL_NOT_FOUND_VALUE, BLACKLIST_TTL_SECONDS, function (err) {
                            completionFunction(null, null, true);
                        });
                    });
                }
            });
        });
    };

    return r;
}();

