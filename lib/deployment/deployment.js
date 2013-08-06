var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../util/util");

var uuid = require("node-uuid");

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);

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
        var host = uuid.v4() + "." + descriptor.domain;

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

        fs.writeFile(path.join(hostDirectoryPath, "gitana.json"), JSON.stringify(json, null, "  "), function(err) {

            callback(err);

        });

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
     *     /abc.cloudcms.net
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

    var doDeploy = function(descriptor, callback)
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
                console.log("Deploying application: " + descriptor.application.id + " to host: " + host);

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

                        // optionally write any require gitana config into the virtual host
                        doHandleWriteGitanaConfiguration(descriptor, hostDirectoryPath, function(err) {

                            if (err) {
                                callback(err, host);
                                return;
                            }

                            var sourceType = descriptor.source.type;
                            var sourceUrl = descriptor.source.uri;

                            if ("github" === sourceType)
                            {
                                util.gitCheckout(hostDirectoryPath, sourceUrl, function(err) {

                                    callback(err, host);
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
                });
            }
        })
    };

    var doUndeploy = function(descriptor, callback)
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
                console.log("Undeploying application: " + descriptor.application.id + " from host: " + host);

                storage.removeHostDirectory(host, function(err) {
                    callback(err);
                });
            }

        });
    };

    var doStart = function(descriptor, callback)
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

                    console.log("Starting application: " + data.application.id + " with host: " + host);

                    fs.writeFile(descriptorFilePath, JSON.stringify(data, null, "  "), function(err){
                        callback(err);
                    });
                });
            }

        });
    };

    var doStop = function(descriptor, callback)
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

                    console.log("Stopping application: " + data.application.id + " with host: " + host);

                    fs.writeFile(descriptorFilePath, JSON.stringify(data, null, "  "), function(err){
                        callback(err);
                    });
                });
            }

        });
    };

    var doInfo = function(host, callback)
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
                        hostPort += ":2999";
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
                    doDeploy(req.body, function(err, host) {

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
                    doUndeploy(req.body, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
                        }

                        doDeploy(req.body, function(err) {

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
                    doUndeploy(req.body, function(err) {

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
                    doStart(req.body, function(err) {

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
                    doStop(req.body, function(err) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message,
                                "err": err
                            });
                            res.end();
                            return;
                        }

                        doStart(req.body, function(err) {

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
                    doStop(req.body, function(err) {

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

                    doInfo(host, function(err, infoObject) {

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

