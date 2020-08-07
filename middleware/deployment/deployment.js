//var path = require('path');
//var fs = require('fs');
//var http = require('http');
var util = require("../../util/util");
//var uuidv4 = require("uuid/v4");
//var Gitana = require("gitana");
var duster = require("../../duster/index");

/**
 * Deployment middleware.
 *
 * Catches any deployment events and handles them, writing files out to disk and flushing any caches.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var parseHost = function(descriptor, callback)
    {
        if (!descriptor.host)
        {
            return callback({
                "message": "Missing host in descriptor"
            });
        }

        callback(null, descriptor.host);
    };

    /*
    var ensureDescriptorHasHost = function(descriptor)
    {
        // if the "host" field is already present on the descriptor, then we reuse that host
        if (descriptor.host)
        {
            return callback(null, descriptor.host);
        }

        // otherwise, we generate a host
        var host = uuidv4() + "-hosted." + descriptor.domain;

        descriptor.host = host;
    };
    */

    var doHandleWriteGitanaConfiguration = function(descriptor, rootStore, callback)
    {
        if (!descriptor.deployment.clientKey)
        {
            return callback();
        }

        var baseURL = "https://api.cloudcms.com";
        if (descriptor.deployment.test) {
            baseURL = "http://localhost:8080";
        }
        if (descriptor.deployment.baseURL) {
            baseURL = descriptor.deployment.baseURL;
        }

        var json = {
            "baseURL": baseURL,
            "application": descriptor.application.id
        };
        if (descriptor.deployment.clientKey) {
            json.clientKey = descriptor.deployment.clientKey;
        }
        if (descriptor.deployment.clientSecret) {
            json.clientSecret = descriptor.deployment.clientSecret;
        }
        if (descriptor.deployment.username) {
            json.username = descriptor.deployment.username;
        }
        if (descriptor.deployment.password) {
            json.password = descriptor.deployment.password;
        }

        var writeIt = function() {

            rootStore.writeFile("gitana.json", JSON.stringify(json, null, "  "), function(err) {
                callback(err);
            });
        };

        // if there is an existing gitana.json, delete it
        rootStore.existsFile("gitana.json", function(exists) {
            if (exists)
            {
                rootStore.deleteFile("gitana.json", function(err) {

                    if (err) {
                        return callback(err);
                    }

                    writeIt();
                });
            }
            else
            {
                writeIt();
            }
        });
    };

    /**
     * The descriptor looks like this:
     *
     *  {
     *      "deployment": {
     *          "clientKey": "<clientKey>",
     *          "clientSecret": "<clientSecret>",
     *          "username": "<username>",
     *          "password": "<password>",
     *          "test": <boolean - whether test mode>
     *      },
     *      "source": {
     *          "type": "<sourceType>",
     *          "public": <boolean - whether public source repository or not>,
     *          "uri": "<sourceUri>"
     *      },
     *      "tenant": {
     *          "id": "<id>",
     *          "title": "<title>",
     *          "description": "<description>",
     *          "dnsSlug": "<dnsSlug>"
     *      },
     *      "application": {
     *          "id": "<id>",
     *          "title": "<title>",
     *          "description": "<description>",
     *          "key": "<key>"
     *      },
     *      "domain": "<domain>",
     *      "host": "<host>" (if already deployed)
     *  }
     *
     * HTML content is deployed to:
     *
     *   /hosts
     *     /<host>
     *       /public
     *
     * @param descriptor
     * @param callback
     */
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // COMMAND HANDLERS
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var doDeploy = function(logFn, descriptor, callback)
    {
        //console.log("DESCRIPTOR: " + JSON.stringify(descriptor, null, 2));

        if (!logFn) {
            logFn = function(text) { console.log(text); }
        }

        if (!descriptor) {
            return callback({
                "message": "Missing descriptor"
            });
        }

        if (!descriptor.application) {
            return callback({
                "message": "Missing descriptor application"
            });
        }

        if (!descriptor.host)
        {
            return callback({
                "message": "Descriptor is missing host"
            });
        }

        parseHost(descriptor, function(err, host) {

            if (err) {
                return callback(err);
            }

            // construct a "root" store for this host
            var storeService = require("../stores/stores");
            storeService.produce(host, function(err, stores) {

                if (err) {
                    return callback(err);
                }

                var rootStore = stores.root;
                rootStore.allocated(function(allocated) {

                    if (allocated)
                    {
                        return callback({
                            "message": "The application for host: " + host + " is already deployed"
                        });
                    }

                    logFn("Deploying application: " + descriptor.application.id + " to host: " + host);

                    // write the descriptor.json file
                    rootStore.writeFile("descriptor.json", JSON.stringify(descriptor, null, "  "), function (err) {

                        if (err) {
                            return callback(err);
                        }

                        var completionHandler = function (err) {

                            if (err) {
                                return callback(err);
                            }

                            // optionally write any require gitana config into the virtual host
                            doHandleWriteGitanaConfiguration(descriptor, rootStore, function (err) {

                                // invalidate gitana driver for this application
                                process.broadcast.publish("application_invalidation", {
                                    "applicationId": descriptor.application.id,
                                    "host": host
                                });

                                // CACHE: INVALIDATE
                                process.deploymentDescriptorCache.invalidate(host, function() {
                                    process.driverConfigCache.invalidate(host, function() {

                                        logFn("Completed deployment of application: " + descriptor.application.id + " to host: " + host);

                                        callback(err);

                                    });
                                });
                            });
                        };

                        // do the checkout
                        var sourceType = (descriptor.source ? descriptor.source.type : null);
                        var sourceUrl = (descriptor.source ? descriptor.source.uri : null);
                        var sourcePath = (descriptor.source ? descriptor.source.path : null);
                        if (!sourcePath) {
                            sourcePath = "/";
                        }
                        var sourceBranch = (descriptor.source ? descriptor.source.branch : null);
                        if (!sourceBranch) {
                            sourceBranch = "master";
                        }
                        if ("github" === sourceType || "bitbucket" === sourceType)
                        {
                            var targetStore = rootStore;
                            var targetOffsetPath = null;

                            util.gitCheckout(host, sourceType, sourceUrl, sourcePath, sourceBranch, targetStore, targetOffsetPath, true, logFn, function (err) {
                                completionHandler(err);
                            });
                        }
                        else
                        {
                            util.installPackagedDeployment(host, "default", logFn, function(err) {
                                completionHandler(err);
                            });
                        }
                    });
                });
            });
        });
    };

    var doUndeploy = function(logFn, descriptor, callback)
    {
        if (!logFn) {
            logFn = function(text) { console.log(text); }
        }

        parseHost(descriptor, function(err, host) {

            if (err) {
                return callback(err);
            }

            // construct a "root" store for this host
            var storeService = require("../stores/stores");
            storeService.produce(host, function(err, stores) {

                if (err) {
                    return callback(err);
                }

                var rootStore = stores.root;
                rootStore.allocated(function (allocated) {

                    if (!allocated) {
                        return callback({
                            "message": "The application is not currently deployed."
                        });
                    }

                    logFn("Undeploying application: " + descriptor.application.id + " from host: " + host);

                    // invalidate any cache state for this application
                    logFn("Invalidating application cache for application: " + descriptor.application.id);
                    process.cache.invalidateCacheForApp(descriptor.application.id);

                    // invalidate "duster" cache for this application
                    logFn("Invalidating duster cache for application: " + descriptor.application.id);
                    duster.invalidateCacheForApp(descriptor.application.id);

                    // invalidate gitana driver for this application
                    process.broadcast.publish("application_invalidation", {
                        "applicationId": descriptor.application.id,
                        "host": host
                    });

                    // remove host directory
                    logFn("Removing host directory: " + host);
                    rootStore.cleanup(function(err) {

                        // CACHE: INVALIDATE
                        process.deploymentDescriptorCache.invalidate(host, function() {
                            process.driverConfigCache.invalidate(host, function() {

                                logFn("Completed undeployment of application: " + descriptor.application.id + " from host: " + host);

                                callback(err);

                            });
                        });
                    });
                });
            });
        });
    };

    var doStart = function(logFn, descriptor, callback)
    {
        parseHost(descriptor, function(err, host) {

            if (err) {
                return callback(err);
            }

            // construct a "root" store for this host
            var storeService = require("../stores/stores");
            storeService.produce(host, function(err, stores) {

                if (err) {
                    return callback(err);
                }

                var rootStore = stores.root;
                rootStore.allocated(function(allocated) {

                    console.log("H2: " + allocated);
                    if (!allocated) {
                        callback({
                            "message": "The application cannot be started because it is not deployed."
                        });
                    }
                    else
                    {
                        rootStore.readFile("descriptor.json", function (err, data) {

                            if (err) {
                                return callback(err);
                            }

                            data = JSON.parse(data);

                            // is it already started?
                            if (data.active) {
                                return callback({
                                    "message": "The application is already started"
                                });
                            }

                            data.active = true;

                            logFn("Starting application: " + data.application.id + " with host: " + host);

                            rootStore.writeFile("descriptor.json", JSON.stringify(data, null, "  "), function (err) {
                                console.log("Start error: "+ err);
                                callback(err);
                            });
                        });
                    }
                });
            });
        });
    };

    var doStop = function(logFn, descriptor, callback)
    {
        parseHost(descriptor, function(err, host) {

            if (err) {
                return callback(err);
            }

            // construct a "root" store for this host
            var storeService = require("../stores/stores");
            storeService.produce(host, function(err, stores) {

                if (err) {
                    return callback(err);
                }

                var rootStore = stores.root;
                rootStore.allocated(function(allocated) {

                    if (!allocated) {
                        callback({
                            "message": "The application cannot be stopped because it is not deployed."
                        });
                    }
                    else
                    {
                        rootStore.readFile("descriptor.json", function (err, data) {

                            if (err) {
                                return callback(err);
                            }

                            data = JSON.parse(data);

                            // is it already stopped?
                            if (!data.active) {
                                return callback({
                                    "message": "The application is already stopped"
                                });
                            }

                            delete data.active;

                            logFn("Stopping application: " + data.application.id + " with host: " + host);

                            rootStore.writeFile("descriptor.json", JSON.stringify(data, null, "  "), function (err) {

                                logFn("Completed stop of application: " + data.application.id + " with host: " + host);

                                callback(err);
                            });
                        });
                    }
                });
            });
        });
    };

    var doInfo = function(logFn, host, callback)
    {
        var r = {
            "isDeployed": false
        };

        // construct a "root" store for this host
        var storeService = require("../stores/stores");
        storeService.produce(host, function(err, stores) {

            if (err) {
                return callback(err);
            }

            var rootStore = stores.root;
            rootStore.allocated(function (allocated) {

                if (allocated) {
                    r.isDeployed = allocated;

                    rootStore.readFile("descriptor.json", function (err, data) {

                        if (err) {
                            return callback(err);
                        }

                        r.descriptor = JSON.parse(data);
                        r.descriptor.host = host;

                        // urls
                        parseHost(r.descriptor, function (err, host) {

                            if (err) {
                                return callback(err);
                            }

                            var hostPort = host;
                            if (r.descriptor.deployment.test) {
                                hostPort += ":" + process.env.PORT;
                            }

                            r.urls = ["http://" + hostPort, "https://" + hostPort];

                            callback(null, r);
                        })
                    });
                }
                else {
                    callback(null, r);
                }
            });
        });
    };

    var doCleanup = function(logFn, host, callback)
    {
        if (!host)
        {
            return callback({
                "message": "Missing or empty host"
            });
        }

        // construct a "root" store for this host
        var storeService = require("../stores/stores");
        storeService.produce(host, function(err, stores) {

            if (err) {
                return callback(err);
            }

            var rootStore = stores.root;
            rootStore.allocated(function (allocated) {

                if (!allocated) {
                    // not deployed, skip out
                    return callback();
                }

                // remove host directory
                logFn("Removing host directory: " + host);
                rootStore.cleanup(function (err) {

                    // CACHE: INVALIDATE
                    process.deploymentDescriptorCache.invalidate(host, function() {
                        process.driverConfigCache.invalidate(host, function() {

                            logFn("Cleaned up virtual hosting for host: " + host);

                            callback(err);

                        });
                    });
                });
            });
        });
    };

    var logFn = function(text)
    {
        console.log("[DEPLOYMENT] " + text);
    };

    var bindSubscriptions = function()
    {
        if (process.broadcast)
        {
            // LISTEN: "deploy_app"
            process.broadcast.subscribe("deploy_app", function (message, channel, done) {

                if (!done) {
                    done = function() { };
                }

                console.log("HEARD: deploy_app");

                doDeploy(logFn, message.body, function(err) {
                    done(err);
                });
            });

            // LISTEN: "undeploy_app"
            process.broadcast.subscribe("undeploy_app", function (message, channel, done) {

                if (!done) {
                    done = function() { };
                }

                console.log("HEARD: undeploy_app");

                doUndeploy(logFn, message.body, function(err) {
                    done(err);

                });
            });

            // LISTEN: "redeploy_app"
            process.broadcast.subscribe("redeploy_app", function (message, channel, done) {

                if (!done) {
                    done = function() { };
                }

                console.log("HEARD: redeploy_app");

                doUndeploy(logFn, message.body, function(err) {

                    if (err) {
                        return done(err);
                    }

                    doDeploy(logFn, message.body, function(err) {
                        done(err);
                    });
                });
            });

            // LISTEN: "start_app"
            process.broadcast.subscribe("start_app", function (message, channel, done) {

                if (!done) {
                    done = function() { };
                }

                console.log("HEARD: start_app");

                doStart(logFn, message.body, function(err) {
                    done(err);

                });
            });


            // LISTEN: "stop_app"
            process.broadcast.subscribe("stop_app", function (message, channel, done) {

                if (!done) {
                    done = function() { };
                }

                console.log("HEARD: stop_app");

                doStop(logFn, message.body, function(err) {
                    done(err);

                });
            });

            // LISTEN: "restart_app"
            process.broadcast.subscribe("restart_app", function (message, channel, done) {

                if (!done) {
                    done = function() { };
                }

                console.log("HEARD: restart_app");

                doStop(logFn, message.body, function(err) {

                    if (err) {
                        return done(err);
                    }

                    doStart(logFn, message.body, function(err) {
                        done(err);
                    });
                });
            });

            // LISTEN: "cleanup_app"
            process.broadcast.subscribe("cleanup_app", function (message, channel, done) {

                if (!done) {
                    done = function() { };
                }

                console.log("HEARD: cleanup_app: " + message.host);

                doCleanup(logFn, message.host, function(err) {
                    done(err);

                });
            });


        }
    };


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Handles deployment commands.
     *
     * This handler looks for commands to the server and intercepts them.  These are handled through a separate
     * codepath whose primary responsibility is to get the files down to disk so that they can be virtually hosted.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        // bind listeners for broadcast events
        bindSubscriptions();

        return util.createHandler("deployment", function(req, res, next, stores, cache, configuration) {

            // if virtual hosts aren't enabled, then we don't allow for deployment operations
            if (!process.configuration || !process.configuration.virtualHost || !process.configuration.virtualHost.enabled)
            {
                return next();
            }

            var handled = false;

            if (req.method.toLowerCase() === "post") {

                if (req.url.indexOf("/_deploy") === 0)
                {
                    process.broadcast.publish("deploy_app", {
                        "body": req.body
                    }, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });

                            return res.end();
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_undeploy") === 0)
                {
                    process.broadcast.publish("undeploy_app", {
                        "body": req.body
                    }, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });

                            return res.end();
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_redeploy") === 0)
                {
                    process.broadcast.publish("redeploy_app", {
                        "body": req.body
                    }, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            return res.end();
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_start") === 0)
                {
                    process.broadcast.publish("start_app", {
                        "body": req.body
                    }, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });

                            return res.end();
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_restart") === 0)
                {
                    process.broadcast.publish("restart_app", {
                        "body": req.body
                    }, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });

                            return res.end();
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_stop") === 0)
                {
                    process.broadcast.publish("stop_app", {
                        "body": req.body
                    }, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            return res.end();
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_cleanup") === 0)
                {
                    var host = req.query["host"];

                    process.broadcast.publish("cleanup_app", {
                        "host": host
                    }, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            return res.end();
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
            }
            else if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_info") === 0)
                {
                    var host = req.query["host"];

                    var logFn = req.log;

                    doInfo(logFn, host, function(err, infoObject) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            return res.end();
                        }

                        // respond with ok
                        res.send({
                            "ok": true,
                            "info": infoObject
                        });
                        res.end();
                    });
                    handled = true;
                }
                else if (req.url.indexOf("/_ping") === 0)
                {
                    res.send({
                        "ok": true
                    });
                    res.end();
                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }
        });
    };

    return r;
}();

