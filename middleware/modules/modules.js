var path = require('path');
var util = require("../../util/util");
var request = require("request");
var async = require("async");

exports = module.exports = function()
{
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

    var doDeploy = function(req, host, moduleId, source, callback)
    {
        // construct a "root" store for this host
        var storeService = require("../stores/stores");
        storeService.produce(host, function(err, stores) {

            if (err) {
                callback(err);
                return;
            }

            var rootStore = stores.root;

            rootStore.allocated(function(allocated) {

                if (!allocated)
                {
                    callback({
                        "message": "The application for host: " + host + " is not deployed"
                    });
                    return;
                }

                var sourceType = source.type;
                if (!sourceType)
                {
                    callback({
                        "message": "The source descriptor is missing the module 'type' field"
                    });
                    return;
                }

                var sourceUrl = source.uri;
                if (!sourceUrl)
                {
                    callback({
                        "message": "The source descriptor is missing the module 'uri' field"
                    });
                    return;
                }

                var sourcePath = source.path;
                if (!sourcePath) {
                    sourcePath = "/";
                }

                if ("github" === sourceType || "bitbucket" == sourceType)
                {
                    util.gitCheckout(host, sourceType, sourceUrl, sourcePath, "modules/" + moduleId, false, req.log, function (err) {
                        callback(err);
                    });
                }
                else
                {
                    callback();
                }

            });
        });
    };

    var doUndeploy = function(req, host, moduleId, callback)
    {
        // construct a "root" store for this host
        var storeService = require("../stores/stores");
        storeService.produce(host, function(err, stores) {

            if (err) {
                callback(err);
                return;
            }

            var rootStore = stores.root;
            rootStore.allocated(function (allocated) {

                if (!allocated) {
                    callback({
                        "message": "The application is not currently deployed."
                    });
                    return;
                }

                rootStore.cleanup("/modules/" + moduleId, function(err) {
                    callback(err);
                });
            });
        });
    };

    r.handler = function()
    {
        return util.createHandler("modules", function(req, res, next, configuration, stores) {

            var handled = false;

            if (req.method.toLowerCase() === "post")
            {
                /**
                 * Deploy
                 *
                 * The incoming payload looks like:
                 *
                 *     {
                 *         "type": "github",
                 *         "uri": "https://github.com/gitana/sdk.git",
                 *         "path": "oneteam/sample"
                 *     }
                 */
                if (req.url.indexOf("/_modules/_deploy") === 0)
                {
                    var moduleId = req.query["id"];

                    doDeploy(req, req.domainHost, moduleId, req.body, function(err, host) {

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
                else if (req.url.indexOf("/_modules/_undeploy") === 0)
                {
                    var moduleId = req.query["id"];

                    doUndeploy(req, req.domainHost, moduleId, function(err) {

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
            else if (req.method.toLowerCase() === "get")
            {
                if (req.url.indexOf("/_modules") === 0)
                {
                    var filePath = req.path.substring(10);

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

                    var filepath = path.join(moduleId, modulePath);
                    store.existsFile(filepath, function(exists) {

                        if (!exists)
                        {
                            res.status(404).end();
                            return;
                        }

                        store.sendFile(res, filePath, function (err) {

                            if (err)
                            {
                                util.handleSendFileError(req, res, filePath, null, req.log, err);
                            }

                        });

                    });

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
