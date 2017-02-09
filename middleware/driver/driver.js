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
                            process.driverConfigCache.invalidate(req.virtualHost, function() {
                                completionFn();
                            });

                        });
                    });

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
                    req.log("Error loading gitana config: " + JSON.stringify(err));
                    return next();
                }

                if (!gitanaConfig)
                {
                    //req.log("Could not find gitana.json file");
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

