var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var uuid = require("node-uuid");
var Gitana = require("gitana");
var duster = require("../../duster");

var DESCRIPTOR_CACHE = require("../../cache/descriptors");
var GITANA_DRIVER_CONFIG_CACHE = require("../../cache/driverconfigs");


/**
 * Deployment middleware.
 *
 * Catches any deployment events and handles them, writing files out to disk and flushing any caches.
 *
 * @type {Function}
 */
exports = module.exports = function(basePath)
{
    var storage = require("../../util/storage")(basePath);

    var parseHost = function(descriptor, callback)
    {
        if (!descriptor.host)
        {
            callback({
                "message": "Missing host in descriptor"
            });
            return;
        }

        callback(null, descriptor.host);
    };

    var generateHost = function(descriptor, callback)
    {
        // if the "host" field is already present on the descriptor, then we reuse that host
        if (descriptor.host)
        {
            callback(null, descriptor.host);
            return;
        }

        // otherwise, we generate a host
        var host = uuid.v4() + "-hosted." + descriptor.domain;

        callback(null, host);
    };

    var doHandleWriteGitanaConfiguration = function(descriptor, hostDirectoryPath, callback)
    {
        if (!descriptor.deployment.clientKey)
        {
            callback();
            return;
        }

        // write the gitana.json config file to
        //    /hosts/<host>/gitana/gitana.json

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

        // if there is an existing gitana.json, delete it
        var gitanaJsonPath = path.join(hostDirectoryPath, "gitana.json");
        if (fs.existsSync(gitanaJsonPath))
        {
            fs.unlinkSync(gitanaJsonPath);
        }

        fs.writeFileSync(gitanaJsonPath, JSON.stringify(json, null, "  "));

        callback();

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

    var doDeploy = function(req, descriptor, callback)
    {
        generateHost(descriptor, function(err, host) {

            if (err) {
                callback(err);
                return;
            }

            if (storage.isDeployed(host))
            {
                callback({
                    "message": "The application for host: " + host + " is already deployed"
                });
            }
            else
            {
                req.log("Deploying application: " + descriptor.application.id + " to host: " + host);

                storage.ensureHostDirectory(host, function(err, hostDirectoryPath) {

                    if (err) {
                        callback(err, host);
                        return;
                    }

                    // write the descriptor.json file
                    fs.writeFile(path.join(hostDirectoryPath, "descriptor.json"), JSON.stringify(descriptor, null, "  "), function(err){

                        if (err) {
                            callback(err, host);
                            return;
                        }

                        var completionHandler = function()
                        {
                            // optionally write any require gitana config into the virtual host
                            doHandleWriteGitanaConfiguration(descriptor, hostDirectoryPath, function(err) {

                                // CACHE: INVALIDATE
                                DESCRIPTOR_CACHE.invalidate(host);
                                GITANA_DRIVER_CONFIG_CACHE.invalidate(host);

                                req.log("Completed deployment of application: " + descriptor.application.id + " to host: " + host);

                                callback(err, host);

                            });
                        };

                        // do the checkout
                        var sourceType = descriptor.source.type;
                        var sourceUrl = descriptor.source.uri;
                        if ("github" === sourceType)
                        {
                            util.gitCheckout(hostDirectoryPath, sourceUrl, function(err) {

                                if (err)
                                {
                                    callback(err, host);
                                    return;
                                }

                                completionHandler(err);
                            });
                        }
                        else
                        {
                            callback({
                                "message": "Unable to deploy source of type: " + sourceType
                            }, host);
                        }

                    });
                });
            }
        })
    };

    var doUndeploy = function(req, descriptor, callback)
    {
        parseHost(descriptor, function(err, host) {

            if (err) {
                callback(err);
                return;
            }

            if (!storage.isDeployed(host))
            {
                callback({
                    "message": "The application is not currently deployed."
                });
            }
            else
            {
                req.log("Undeploying application: " + descriptor.application.id + " from host: " + host);

                // invalidate any cache state for this application
                req.log("Invalidating application cache for application: " + descriptor.application.id);
                process.cache.invalidateCacheForApp(descriptor.application.id);

                // invalidate "duster" cache for this application
                req.log("Invalidating duster cache for application: " + descriptor.application.id);
                duster.invalidateCacheForApp(descriptor.application.id);

                // invalidate gitana driver for this application
                req.log("Invalidating gitana cache for application: " + descriptor.application.id);
                Gitana.disconnect(descriptor.application.id);

                // remove host directory
                req.log("Removing host directory: " + host);
                storage.removeHostDirectory(host, function(err) {

                    // CACHE: INVALIDATE
                    DESCRIPTOR_CACHE.invalidate(host);
                    GITANA_DRIVER_CONFIG_CACHE.invalidate(host);

                    req.log("Completed undeployment of application: " + descriptor.application.id + " from host: " + host);

                    callback(err);
                });
            }

        });
    };

    var doStart = function(req, descriptor, callback)
    {
        parseHost(descriptor, function(err, host) {

            if (err) {
                callback(err);
                return;
            }

            if (!storage.isDeployed(host))
            {
                callback({
                    "message": "The application cannot be started because it is not deployed."
                });
            }
            else
            {
                var descriptorFilePath = path.join(storage.hostDirectoryPath(host), "descriptor.json");
                fs.readFile(descriptorFilePath, function(err, data) {

                    if (err) {
                        callback(err);
                        return;
                    }

                    data = JSON.parse(data);

                    // is it already started?
                    if (data.active)
                    {
                        callback({
                            "message": "The application is already started"
                        });
                        return;
                    }

                    data.active = true;

                    req.log("Starting application: " + data.application.id + " with host: " + host);

                    fs.writeFile(descriptorFilePath, JSON.stringify(data, null, "  "), function(err){
                        callback(err);
                    });
                });
            }

        });
    };

    var doStop = function(req, descriptor, callback)
    {
        parseHost(descriptor, function(err, host) {

            if (err) {
                callback(err);
                return;
            }

            if (!storage.isDeployed(host))
            {
                callback({
                    "message": "The application cannot be stopped because it is not deployed."
                });
            }
            else
            {
                var descriptorFilePath = path.join(storage.hostDirectoryPath(host), "descriptor.json");
                fs.readFile(descriptorFilePath, function(err, data) {

                    data = JSON.parse(data);

                    // is it already stopped?
                    if (!data.active)
                    {
                        callback({
                            "message": "The application is already stopped"
                        });
                        return;
                    }

                    delete data.active;

                    req.log("Stopping application: " + data.application.id + " with host: " + host);

                    fs.writeFile(descriptorFilePath, JSON.stringify(data, null, "  "), function(err){

                        req.log("Completed stop of application: " + data.application.id + " with host: " + host);

                        callback(err);
                    });
                });
            }

        });
    };

    var doInfo = function(req, host, callback)
    {
        var r = {
            "isDeployed": false
        };

        if (storage.isDeployed(host))
        {
            r.isDeployed = storage.isDeployed(host);

            var descriptorFilePath = path.join(storage.hostDirectoryPath(host), "descriptor.json");
            fs.readFile(descriptorFilePath, function(err, data) {

                if (err)
                {
                    callback(err);
                    return;
                }

                r.descriptor = JSON.parse(data);
                r.descriptor.host = host;

                // urls
                parseHost(r.descriptor, function(err, host) {

                    if (err)
                    {
                        callback(err);
                        return;
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
        else
        {
            callback(null, r);
        }
    };

    var doCleanup = function(req, host, callback)
    {
        if (!host)
        {
            callback({
                "message": "Missing or empty host"
            });

            return;
        }

        if (!storage.isDeployed(host))
        {
            // not deployed, skip out
            callback();

            return;
        }

        // remove host directory
        req.log("Removing host directory: " + host);
        storage.removeHostDirectory(host, function(err) {

            // CACHE: INVALIDATE
            DESCRIPTOR_CACHE.invalidate(host);
            GITANA_DRIVER_CONFIG_CACHE.invalidate(host);

            req.log("Cleaned up virtual hosting for host: " + host);

            callback(err);
        });
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
        return function(req, res, next)
        {
            var handled = false;

            if (req.method.toLowerCase() == "post") {

                if (req.url.indexOf("/_deploy") == 0)
                {
                    doDeploy(req, req.body, function(err, host) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
                        }

                        // respond with ok
                        res.send({
                            "ok": true,
                            "host": host
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_redeploy") == 0)
                {
                    doUndeploy(req, req.body, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
                        }

                        doDeploy(req, req.body, function(err) {

                            if (err) {
                                res.send({
                                    "ok": false,
                                    "message": err.message,
                                    "err": err
                                });
                                res.end();
                                return;
                            }

                            // respond with ok
                            res.send({
                                "ok": true
                            });
                            res.end();
                        });
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_undeploy") == 0)
                {
                    doUndeploy(req, req.body, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_start") == 0)
                {
                    doStart(req, req.body, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_restart") == 0)
                {
                    doStop(req, req.body, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
                        }

                        doStart(req, req.body, function(err) {

                            if (err) {
                                res.send({
                                    "ok": false,
                                    "message": err.message,
                                    "err": err
                                });
                                res.end();
                                return;
                            }

                            // respond with ok
                            res.send({
                                "ok": true
                            });
                            res.end();
                        });
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_stop") == 0)
                {
                    doStop(req, req.body, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
                        }

                        // respond with ok
                        res.send({
                            "ok": true
                        });
                        res.end();
                    });

                    handled = true;
                }
                else if (req.url.indexOf("/_cleanup") == 0)
                {
                    var host = req.param("host");

                    doCleanup(req, host, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
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
            else if (req.method.toLowerCase() == "get") {

                if (req.url.indexOf("/_info") == 0)
                {
                    var host = req.param("host");

                    doInfo(req, host, function(err, infoObject) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
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
                else if (req.url.indexOf("/_ping") == 0)
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
        }
    };

    return r;
};

