var path = require('path');
var http = require('http');
var util = require("../../util/util");
var async = require("async");

var Gitana = require("gitana");

////////////////////////////////////////////////////////////////////////////
//
// INTERFACE METHODS
//
////////////////////////////////////////////////////////////////////////////

exports = module.exports = function()
{
    var resolveGitanaConfig = function(req, callback)
    {
        var json = req.gitanaConfig;
        if (json)
        {
            // we force the cache key to the application id
            json.key = json.application;
            if (!json.key)
            {
                json.key = "default";
            }
        }

        callback(null, json);
    };

    var autoRefreshRunner = function()
    {
        var configuration = process.configuration;

        var diLog = function(text)
        {
            var shouldLog = configuration && configuration.autoRefresh && configuration.autoRefresh.log;
            shouldLog = true;
            if (shouldLog)
            {
                console.log(text);
            }
        };

        // AUTO REFRESH PROCESS
        // set up a background process that refreshes the appuser access token every 30 minutes
        setInterval(function() {

            diLog("Gitana Driver Health Check thread running...");

            // gather all of the configs that we'll refresh (keyed by host -> gitana config)
            var driverConfigs = {};
            if (configuration.virtualDriver && configuration.virtualDriver.enabled)
            {
                driverConfigs["virtual"] = configuration.virtualDriver;
            }

            // also refresh any of our cached driver config state
            process.driverConfigCache.keys(function(err, keys) {

                // collect functions to read driver configs from cache
                var fns = [];
                if (keys)
                {
                    for (var t = 0; t < keys.length; t++)
                    {
                        var fn = function (driverConfigs, key) {
                            return function (done) {
                                process.driverConfigCache.read(key, function (err, c) {
                                    driverConfigs[key] = c.config;
                                    done();
                                });
                            };
                        }(driverConfigs, keys[t]);
                        fns.push(fn);
                    }
                }

                // run functions
                async.series(fns, function() {

                    var hosts = [];
                    for (var host in driverConfigs)
                    {
                        hosts.push(host);
                    }

                    if (hosts.length === 0)
                    {
                        // no hosts, we're all done
                        return;
                    }

                    console.log("Processing hosts: " + JSON.stringify(hosts));

                    var f = function(i)
                    {
                        if (i === hosts.length)
                        {
                            // we're done
                            diLog("Gitana Driver Health Check thread finished");
                            return;
                        }

                        var host = hosts[i];
                        var gitanaConfig = driverConfigs[host];

                        if (gitanaConfig && typeof(gitanaConfig) == "object")
                        {
                            console.log("WORKING ON HOST: " + host);
                            console.log("WORKING ON CONFIG: " + JSON.stringify(gitanaConfig, null, "  "));

                            Gitana.connect(gitanaConfig, function(err) {

                                diLog(" -> [" + host + "] running health check");

                                var g = this;

                                if (err)
                                {
                                    diLog(" -> [" + host + "] Caught error while running auto-refresh");
                                    diLog(" -> [" + host + "] " + err);
                                    diLog(" -> [" + host + "] " + JSON.stringify(err));

                                    diLog(" -> [" + host + "] Removing key: " + gitanaConfig.key);
                                    Gitana.disconnect(gitanaConfig.key);

                                    // remove from cache
                                    process.driverConfigCache.invalidate(host, function() {
                                        f(i+1);
                                    });

                                    return;
                                }
                                else
                                {
                                    diLog(" -> [" + host + "] refresh for host: " + host);

                                    g.getDriver().refreshAuthentication(function(err) {

                                        if (err) {
                                            diLog(" -> [" + host + "] Refresh Authentication caught error: " + JSON.stringify(err));

                                            diLog(" -> [" + host + "] Auto disconnecting key: " + gitanaConfig.key);
                                            Gitana.disconnect(gitanaConfig.key);

                                            // remove from cache
                                            process.driverConfigCache.invalidate(host, function() {
                                                // all done
                                            });

                                        } else {
                                            diLog(" -> [" + host + "] Successfully refreshed authentication for appuser");
                                            diLog(" -> [" + host + "] grant time: " + new Date(g.getDriver().http.grantTime()));
                                            diLog(" -> [" + host + "] access token: " + g.getDriver().http.accessToken());
                                        }

                                        f(i+1);
                                    });
                                }
                            });
                        }
                        else
                        {
                            // otherwise, skip
                            console.log("SKIPPING SINCE NO CONFIGURATION FOUND");

                            f(i+1);
                        }

                    };

                    f(0);
                });
            });

        }, (30*60*1000)); // thirty minutes
    };


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    var doConnect = r.doConnect = function(req, gitanaConfig, callback)
    {
        // either connect anew or re-use an existing connection to Cloud CMS for this application
        Gitana.connect(gitanaConfig, function(err) {

            if (err)
            {
                var completionFn = function() {

                    // either
                    //   a) we're not supposed to be able to connect because guest was attempted and is not allowed
                    //   b) non-guest and something went wrong

                    if (!gitanaConfig.username || gitanaConfig.username == "guest")
                    {
                        // guest mode
                        err.output = "Unable to connect to Cloud CMS as guest user";
                        if (err.message) {
                            err.output += "<br/>";
                            err.output += err.message;
                        }
                    }
                    else
                    {
                        // otherwise assume that it is a configuration error?
                        err.output = "There was a problem connecting to your tenant.  Please refresh your browser to try again or contact Cloud CMS for assistance.";
                        if (err.message) {
                            err.output += "<br/>";
                            err.output += err.message;
                        }
                    }

                    callback.call(this, err);
                };

                //
                // if the "gitana.json" came from a virtual driver acquire, then it might have changed and we
                // may need to reload it.  we therefore delete it here (if _virtual = true)
                if (gitanaConfig._virtual)
                {
                    var rootStore = req.stores.root;

                    var originalFilename = "gitana.json";
                    var backupFilename = "gitana.json.backup-" + new Date().getTime();

                    console.log("Backing up: gitana.json to: " + backupFilename);
                    rootStore.writeFile(backupFilename, JSON.stringify(gitanaConfig, null, "  "), function(err) {
                        rootStore.removeFile(originalFilename, function(err) {

                            // remove from cache
                            process.driverConfigCache.invalidate(req.domainHost, function() {
                                completionFn();
                            });

                        });
                    });

                    return;
                }

                completionFn();

                return;
            }

            callback.call(this, err);
        });
    };

    /**
     * Ensures that a Cloud CMS driver is active and bound to the request.
     *
     * @return {Function}
     */
    r.driverInterceptor = function()
    {
        // the auto refresh runner ensures that the virtual driver gitana is always refreshed
        autoRefreshRunner();

        return function(req, res, next)
        {
            resolveGitanaConfig(req, function(err, gitanaConfig) {

                if (err) {
                    req.log("Error loading gitana config: " + JSON.stringify(err));
                    next();
                    return;
                }

                if (!gitanaConfig)
                {
                    //req.log("Could not find gitana.json file");
                    next();
                    return;
                }

                if (!gitanaConfig.key)
                {
                    gitanaConfig.key = gitanaConfig.application;
                }

                // either connect anew or re-use an existing connection to Cloud CMS for this application
                doConnect(req, gitanaConfig, function(err) {

                    if (err)
                    {
                        var configString = "null";
                        if (gitanaConfig) {
                            configString = JSON.stringify(gitanaConfig);
                        }

                        // console.log("Cannot connect to Cloud CMS for path: " + req.path + ", config: " + configString + ", message: " + JSON.stringify(err));

                        // send back error
                        util.status(res, err.status);
                        res.send(err.output);
                        res.end();
                        return;
                    }

                    req.gitana = this;
                    req.applicationId = gitanaConfig.application;
                    req.principalId = this.getDriver().getAuthInfo().getPrincipalId();

                    next();
                });

            });
        }
    };

    return r;
}();

