var path = require('path');
var util = require("../../util/util");

var storeService = require("../stores/stores");
var configService = require("../config/config");

exports = module.exports = function()
{
    var logFn = function(text)
    {
        console.log("[Module Deployment] " + text);
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // COMMAND HANDLERS
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var doDeploy = function(host, moduleId, moduleConfig, callback)
    {
        logFn("Start doDeploy, host: " + host + ", module ID: " + moduleId + ", module config: " + JSON.stringify(moduleConfig, null, 2));;

        if (!moduleConfig)
        {
            return callback({
                "message": "Missing module config argument"
            });
        }

        if (!moduleConfig.source)
        {
            return callback({
                "message": "Missing module config source settings"
            });
        }

        var sourceType = moduleConfig.source.type;
        if (!sourceType)
        {
            return callback({
                "message": "The source descriptor is missing the module 'type' field"
            });
        }

        var sourceUrl = moduleConfig.source.uri;
        if (!sourceUrl)
        {
            return callback({
                "message": "The source descriptor is missing the module 'uri' field"
            });
        }

        var sourcePath = moduleConfig.source.path;
        if (!sourcePath) {
            sourcePath = "/";
        }

        var sourceBranch = moduleConfig.source.branch;
        if (!sourceBranch) {
            sourceBranch = "master";
        }

        if ("github" === sourceType || "bitbucket" === sourceType)
        {
            logFn("Begin util.gitCheckout");

            // create a "root" store for the host
            storeService.produce(host, function(err, stores) {

                if (err) {
                    return callback(err);
                }

                var targetStore = stores["modules"];
                var targetOffsetPath = moduleId;

                util.gitCheckout(host, sourceType, sourceUrl, sourcePath, sourceBranch, targetStore, targetOffsetPath, false, logFn, function (err) {

                    //logFn("After util.gitCheckout: " + JSON.stringify(err));

                    // invalidate any caching within the stores layer
                    storeService.invalidate(host);

                    //logFn("After store.invalidate");

                    callback(err);
                });
            });
        }
        else
        {
            callback();
        }
    };

    var doUndeploy = function(host, moduleId, moduleConfig, cacheOnly, callback)
    {
        var logFn = function(text) {
            console.log(text);
        };

        logFn("Start doUndeploy, host: " + host + ", module ID: " + moduleId + ", module config: " + JSON.stringify(moduleConfig, null, 2));;

        storeService.produce(host, function(err, stores) {

            // invalidate any caching within the stores layer
            storeService.invalidate(host);

            var options = {};
            if (cacheOnly) {
                options.cacheOnly = true;
            }

            var modulesStore = stores.modules;
            modulesStore.cleanup(moduleId, options, function(err) {
                callback(err);
            });
        });
    };

    var doRedeploy = function(host, moduleId, moduleConfig, callback)
    {
        doUndeploy(host, moduleId, moduleConfig, false, function(err) {

            if (err) {
                return callback(err);
            }

            doDeploy(host, moduleId, moduleConfig, function(err) {
                callback(err);
            });
        });
    };

    var doInvalidate = function(host, moduleId, moduleConfig, callback)
    {
        var logFn = function(text) {
            console.log(text);
        };

        //logFn("Start doInvalidate, host: " + host + ", module ID: " + moduleId + ", module config: " + JSON.stringify(moduleConfig, null, 2));;

        // invalidate any caching within the stores layer
        storeService.invalidate(host);

        // blow away config service cache
        configService.invalidateHost(host, function(err) {
            //logFn("Finish doInvalidate");
            callback();
        });
    };

    var acquireConcurrencyIdentifier = function(messageId)
    {
        var concurrencyIdentifier = null;

        if (process.env.CLOUDCMS_MODULES_STORE_PERSISTENCE_BACKED === "true")
        {
            concurrencyIdentifier = messageId;
        }

        return concurrencyIdentifier;
    };

    var bindSubscriptions = function()
    {
        if (process.broadcast)
        {
            // LISTEN: "module_deploy"
            process.broadcast.subscribe("module_deploy", function (message, channel, finished) {

                if (!finished) {
                    finished = function () {};
                }

                console.log("Modules subscription listener triggered for: module_deploy");

                var host = message.host;
                var moduleId = message.moduleId;
                var moduleConfig = message.moduleConfig;
                var messageId = message.id;

                var identifier = acquireConcurrencyIdentifier(messageId);
                util.executeFunction(identifier, function(exclusiveFirst, doneFn) {

                    // if we are the exclusive first server, we do a full redeploy
                    // this removes everything from local disk (for current server) but also deletes from persistence (S3)
                    // it then deploys (writing to local server disk as well as S3)
                    if (exclusiveFirst)
                    {
                        return doRedeploy(host, moduleId, moduleConfig, function(err) {
                            return doneFn(err);
                        });
                    }

                    // otherwise, the "exclusiveFirst" operations already ran on another server
                    // and we run this part concurrent with other servers
                    // after this finishes, any new requests will fault things from S3
                    doUndeploy(host, moduleId, moduleConfig, true, function(err) {
                        return doneFn(err);
                    });

                }, function(err) {

                    // invalidate this server
                    doInvalidate(host, moduleId, moduleConfig, function() {
                        finished(err);
                    });
                });
            });

            // LISTEN: "module_undeploy"
            process.broadcast.subscribe("module_undeploy", function (message, channel, finished) {

                if (!finished) {
                    finished = function () {};
                }

                console.log("Modules subscription listener triggered for: module_undeploy");

                var host = message.host;
                var moduleId = message.moduleId;
                var moduleConfig = message.moduleConfig;
                var messageId = message.id;

                var identifier = acquireConcurrencyIdentifier(messageId);
                util.executeFunction(identifier, function(exclusiveFirst, doneFn) {

                    // if we are the exclusive first server, we do a full undeploy
                    // this removes everything from local disk (for current server) but also deletes from persistence (S3)
                    if (exclusiveFirst)
                    {
                        return doUndeploy(host, moduleId, moduleConfig, false, function(err) {
                            return doneFn(err);
                        });
                    }

                    // otherwise, the "exclusiveFirst" operations already ran on another server
                    // and we run this part concurrent with other servers
                    doUndeploy(host, moduleId, moduleConfig, true, function(err) {
                        return doneFn(err);
                    });

                }, function(err) {

                    // invalidate this server
                    doInvalidate(host, moduleId, moduleConfig, function() {
                        finished(err);
                    });
                });
            });

            // LISTEN: "module_refresh"
            process.broadcast.subscribe("module_refresh", function (message, channel, finished) {

                if (!finished) {
                    finished = function () {};
                }

                console.log("Modules subscription listener triggered for: module_refresh");

                var host = message.host;
                var moduleId = message.moduleId;
                var moduleConfig = message.moduleConfig;
                var messageId = message.id;

                // invalidate this server
                doInvalidate(host, moduleId, moduleConfig, function (err) {
                    finished(err);
                });
            });
        }
    };

    r.handler = function()
    {
        // bind listeners for broadcast events
        bindSubscriptions();

        return util.createHandler("modules", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            if (req.method.toLowerCase() === "post")
            {
                /**
                 * Deploy
                 *
                 * The incoming payload looks like:
                 *
                 *     {
                 *         "source": {
                 *             "type": "github",
                 *             "uri": "https://github.com/gitana/sdk.git",
                 *             "path": "oneteam/sample"
                 *         }
                 *     }
                 */
                if (req.url.indexOf("/_modules/_deploy") === 0)
                {
                    var moduleId = req.query["id"];
                    var host = req.virtualHost;
                    var moduleConfig = req.body;

                    console.log("Heard HTTP Module Deploy -  host: " + host + ", id: " + moduleId + ", config: " + JSON.stringify(moduleConfig));

                    process.broadcast.publish("module_deploy", {
                        "host": host,
                        "moduleId": moduleId,
                        "moduleConfig": moduleConfig
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
                else if (req.url.indexOf("/_modules/_undeploy") === 0)
                {
                    var moduleId = req.query["id"];
                    var host = req.virtualHost;
                    var moduleConfig = req.body;

                    console.log("Heard HTTP Module Undeploy -  host: " + host + ", id: " + moduleId + ", config: " + JSON.stringify(moduleConfig));

                    process.broadcast.publish("module_undeploy", {
                        "host": host,
                        "moduleId": moduleId,
                        "moduleConfig": moduleConfig
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
                /*
                else if (req.url.indexOf("/_modules/_refresh") === 0)
                {
                    var moduleId = req.query["id"];
                    var host = req.virtualHost;
                    var moduleConfig = req.body;

                    console.log("Heard MODULE REFRESH host: " + host + ", id: " + moduleId + ", config: " + JSON.stringify(moduleConfig));

                    process.broadcast.publish("module_refresh", {
                        "host": host,
                        "moduleId": moduleId,
                        "moduleConfig": moduleConfig
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
                */
            }
            else if (req.method.toLowerCase() === "get")
            {
                if (req.url.indexOf("/_modules") === 0)
                {
                    var filePath = null;

                    // skip ahead to everything after the next "/"
                    // this allows for URIs like:
                    //     /_modules-TIMESTAMP/{moduleId}/something.jpg
                    var q = req.path.indexOf("/", 2);
                    if (q > -1)
                    {
                        filePath = req.path.substring(q + 1);
                    }

                    // filePath should now be "{moduleId}/something.jpg"
                    // or "{moduleId}"

                    var moduleId = null;
                    var modulePath = null;

                    var x = filePath.indexOf("/");
                    if (x > -1)
                    {
                        moduleId = filePath.substring(0, x);
                        modulePath = filePath.substring(x + 1);
                    }
                    else
                    {
                        moduleId = filePath;
                    }

                    var store = stores.modules;

                    var assetPath = path.join(moduleId, modulePath);

                    if (modulePath === "index.js" && process.env.CLOUDCMS_APPSERVER_MODE === "production")
                    {
                        // check whether index-prod.js exists, if so, use that
                        var productionAssetPath = path.join(moduleId, "index-prod.js");
                        store.existsFile(productionAssetPath, function(exists) {

                            if (exists)
                            {
                                serveFromStore(req, res, store, productionAssetPath, true);
                            }
                            else
                            {
                                // serve normal version
                                serveFromStore(req, res, store, assetPath);
                            }
                        });
                    }
                    else
                    {
                        serveFromStore(req, res, store, assetPath);
                    }

                    handled = true;
                }
                else if (req.url.indexOf("/oneteam") === 0 && req.url.indexOf("/modules") > -1 && req.url.indexOf("app/") !== 0)
                {
                    // this route handling is provided for support of local modules within OneTeam
                    // the full url is /oneteam-XYZ/modules/{moduleId}/something.jpg

                    var filePath = null;

                    // skip ahead to everything after "/modules/"
                    // this allows for URIs like:
                    //     /oneteam-XYZ/modules-TIMESTAMP/{moduleId}/something.jpg
                    var z = req.path.indexOf("/modules");
                    var q = req.path.indexOf("/", z + 2);
                    if (q > -1)
                    {
                        filePath = req.path.substring(q + 1); // {moduleId}/something.jpg
                    }

                    var oneTeamPath = req.path.substring(1, z); // /oneteam-XYZ

                    // filePath should now be "{moduleId}/something.jpg"
                    // or "{moduleId}"

                    var moduleId = null;
                    var modulePath = null;

                    var x = filePath.indexOf("/");
                    if (x > -1)
                    {
                        moduleId = filePath.substring(0, x);
                        modulePath = filePath.substring(x + 1);
                    }
                    else
                    {
                        moduleId = filePath;
                    }

                    var store = stores.web;

                    var assetPath = path.join(oneTeamPath, "modules", moduleId, modulePath);

                    if (modulePath === "index.js" && process.env.CLOUDCMS_APPSERVER_MODE === "production")
                    {
                        // check whether index-prod.js exists, if so, use that
                        var productionAssetPath = path.join(oneTeamPath, "modules", moduleId, "index-prod.js");
                        store.existsFile(productionAssetPath, function(exists) {

                            if (exists)
                            {
                                serveFromStore(req, res, store, productionAssetPath, true);
                            }
                            else
                            {
                                // serve normal version
                                serveFromStore(req, res, store, assetPath);
                            }

                        });
                    }
                    else
                    {
                        serveFromStore(req, res, store, assetPath);
                    }

                    handled = true;
                }

            }

            if (!handled)
            {
                next();
            }
        });
    };

    var serveFromStore = function(req, res, store, filePath)
    {
        store.existsFile(filePath, function(exists) {

            if (!exists)
            {
                return util.status(res, 404).end();
            }

            store.sendFile(res, filePath, function (err) {

                if (err)
                {
                    util.handleSendFileError(req, res, filePath, null, req.log, err);
                }

            });
        });
    };

    return r;
}();
