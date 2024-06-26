var path = require('path');
var http = require('http');
var util = require("../../util/util");
var async = require("async");

var Loaders = require("../../util/loaders");

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

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    var doConnect = r.doConnect = function(req, gitanaConfig, callback)
    {
        var key = JSON.stringify(gitanaConfig);

        var loader = function(req, gitanaConfig)
        {
            return function(cb)
            {
                _doConnect(req, gitanaConfig, function(err) {
                    cb.call(this, err);
                });
            }
        }(req, gitanaConfig);

        var exclusiveLoader = Loaders.exclusive(loader, key, process.defaultExclusiveLockTimeoutMs);

        exclusiveLoader(function(err) {
            callback.call(this, err);
        });
    };

    var _doConnect = function(req, gitanaConfig, callback)
    {
        // either connect anew or re-use an existing connection to Cloud CMS for this application
        Gitana.connect(gitanaConfig, function(err) {

            if (err)
            {
                // log as much as we can
                if (process.env.NODE_ENV === "production")
                {
                    console.warn("Error connecting driver (domainHost=" + req.domainHost + ", virtualHost: " + req.virtualHost + ", err: " + JSON.stringify(err));
                }
                else
                {
                    console.warn("Error connecting driver (domainHost=" + req.domainHost + ", virtualHost: " + req.virtualHost + ", config: " + JSON.stringify(gitanaConfig) + ", err: " + JSON.stringify(err));
                }

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
                    var backupFilename = "gitana.json.backup-" + Date.now();

                    console.log("Backing up: gitana.json to: " + backupFilename);
                    rootStore.writeFile(backupFilename, JSON.stringify(gitanaConfig, null, "  "), function(err) {
                        rootStore.removeFile(originalFilename, function(err) {
                            completionFn();
                        });
                    });

                    // do these out of main loop
                    if (req.virtualHost) {
                        console.log("Remove driver cache for virtual host: " + req.virtualHost);
                        process.driverConfigCache.invalidate(req.virtualHost, function() { });
                    }

                    if (req.domainHost) {
                        console.log("Remove driver cache for domain host: " + req.domainHost);
                        process.driverConfigCache.invalidate(req.domainHost, function() { });
                    }

                    return;
                }
                else
                {
                    completionFn();
                }

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
        // allow custom configuration of Gitana driver
        if (process.configuration)
        {
            if (process.configuration.gitana)
            {
                if (process.configuration.gitana.params)
                {
                    for (var k in process.configuration.gitana.params)
                    {
                        Gitana.HTTP_PARAMS[k] = process.configuration.gitana.params[k];
                    }
                }
            }
        }

        // bind listeners for broadcast events
        bindSubscriptions();

        return util.createInterceptor("driver", function(req, res, next, stores, cache, configuration) {

            resolveGitanaConfig(req, function(err, gitanaConfig) {

                if (err) {
                    console.warn("Error loading gitana config: " + JSON.stringify(err));
                    return next();
                }

                if (!gitanaConfig)
                {
                    return next();
                }

                if (!gitanaConfig.key)
                {
                    gitanaConfig.key = gitanaConfig.application;
                }

                // either connect anew or re-use an existing connection to Cloud CMS for this application
                doConnect(req, gitanaConfig, function(err) {

                    if (err)
                    {
                        // send back error
                        if (!err.status) {
                            err.status = 503;
                        }
                        util.status(res, err.status);
                        res.send(err.output);
                        res.end();
                        return;
                    }

                    req.gitana = this;
                    req.applicationId = gitanaConfig.application;
                    req.principalId = this.getDriver().getAuthInfo().getPrincipalId();

                    if (!req.gitana.platform) {
                        req.gitana.platform = function() {
                            return req.gitana;
                        }
                    }

                    next();
                });

            });
        });
    };

    var bindSubscriptions = function()
    {
        if (process.broadcast)
        {
            // when an application invalidates, re-initialize the app helpers for any cached drivers
            process.broadcast.subscribe("application_invalidation", function(message, channel, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                var applicationId = message.applicationId;
                var host = message.host;

                console.log("Invalidating Driver Cache for application: " + applicationId + ", host: " + host);

                // find the driver config for this host
                process.driverConfigCache.read(host, function(err, c) {

                    if (err) {
                        return invalidationDone();
                    }

                    if (!c) {
                        return invalidationDone();
                    }

                    if (!c.config) {
                        return invalidationDone();
                    }

                    var driverConfig = c.config;

                    console.log("Found driver config to invalidate: " + driverConfig.key);

                    Gitana.connect(driverConfig, function(err) {

                        if (err) {
                            return invalidationDone();
                        }

                        // NOTE: this = appHelper

                        // re-init the appHelper
                        this.init.call(this, function(err) {
                            console.log("Successfully invalidated driver config: " + driverConfig.key);
                            if (err) {
                                console.log(JSON.stringify(err));
                            }

                        });

                        // fire this here because firing it inside of the init.call callback seems to lose the variable
                        invalidationDone();

                    });
                });
            });
        }
    };

    return r;
}();

