var path = require('path');
var fs = require('fs');
var util = require("../util/util");

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);

    var CACHED_ADAPTERS = {};

    var ensureConfigDirectoryPath = function(host, callback)
    {
        // if we have a host, then hand back the virtual host "config" path
        // otherwise, hand back the /config directory of locally mounted

        var configDirectoryPath = null;
        if (host) {
            configDirectoryPath = path.join(storage.hostDirectoryPath(host), "config");
        }
        else if (process.env.CLOUDCMS_CONFIG_BASE_PATH)
        {
            configDirectoryPath = process.env.CLOUDCMS_CONFIG_BASE_PATH;
        }
//        else
//        {
//            configDirectoryPath = path.join(process.cwd(), "config");
//        }
        fs.exists(configDirectoryPath, function(exists) {

            if (!exists)
            {
                util.mkdirs(configDirectoryPath, function() {
                    callback(null, configDirectoryPath);
                });
            }
            else
            {
                callback(null, configDirectoryPath);
            }
        });
    };

    var bindConfigAdapter = function(host, callback)
    {
        var adapter = CACHED_ADAPTERS[host];
        if (adapter)
        {
            callback(null, adapter);
        }
        else
        {
            ensureConfigDirectoryPath(host, function(err, configDirectoryPath) {

                if (err) {
                    callback({
                        "message": "Unable to acquire or create config directory path: " + configDirectoryPath
                    });
                    return;
                }

                require("./adapter").init(configDirectoryPath, function(adapter) {

                    CACHED_ADAPTERS[host] = adapter;

                    callback(null, adapter);
                });

            });
        }
    };

    var handleConfigRequest = function(host, callback)
    {
        bindConfigAdapter(host, function(err, adapter) {

            if (err) {
                callback({
                    "message": "Unable to bind config adapter for host: " + host + ", err: " + JSON.stringify(err)
                });
                return;
            }

            adapter.loadApplication(function(appConfig) {

                var array = [];

                if (appConfig)
                {
                    array.push({
                        "evaluator": "application",
                        "config": {
                            "application": appConfig
                        }
                    });
                }

                adapter.loadPages(function(pageConfigs) {

                    // collect all gadgets to ensure we only write once
                    var gadgetCollection = {};

                    for (var pageKey in pageConfigs)
                    {
                        var pageConfig = pageConfigs[pageKey];

                        // walk the gadgets
                        // copy into collection
                        for (var gadgetKey in pageConfig.gadgets)
                        {
                            var gadgetConfig = pageConfig.gadgets[gadgetKey];

                            var g = {
                                "evaluator": "gadget",
                                "condition": {
                                    "gadgetType": gadgetConfig.type,
                                    "gadget": gadgetKey
                                },
                                "config": {
                                    "gadgets": {
                                    }
                                }
                            };
                            g.config.gadgets[gadgetConfig.type] = {};
                            g.config.gadgets[gadgetConfig.type][gadgetKey] = gadgetConfig.config;
                            gadgetCollection[gadgetConfig.type + "_" + gadgetKey] = g;
                        }

                        // walk the region bindings
                        for (var region in pageConfig.page.bindings)
                        {
                            var bindingConfig = pageConfig.page.bindings[region];

                            var r = {
                                "evaluator": "page",
                                "condition": pageKey,
                                "config": {
                                    "pages": {
                                    }
                                }
                            };
                            r.config.pages[pageKey] = {
                                "regions": {

                                }
                            };
                            r.config.pages[pageKey].regions[region] = {
                                "gadgetType": bindingConfig.type,
                                "gadget": bindingConfig.key
                            };
                            array.push(r);
                        }

                        var p = {};
                        p.evaluator = "page";
                        p.condition = pageKey;
                        p.config = {
                            "pages": {
                            }
                        };
                        // need to make a copy here since we're about to delete elements
                        p.config.pages[pageKey] = JSON.parse(JSON.stringify(pageConfig.page));
                        delete p.config.pages[pageKey].bindings;
                        delete p.config.pages[pageKey].gadgets;
                        array.push(p);
                    }

                    // push everything from gadget collection into config array
                    for (var k in gadgetCollection)
                    {
                        array.push(gadgetCollection[k]);
                    }

                    callback(null, array);
                });

            });
        });
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Retrieves configuration for the application.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return function(req, res, next)
        {
            var handled = false;

            if (req.method.toLowerCase() == "get") {

                if (req.url.indexOf("/_config") == 0)
                {
                    var host = req.virtualHost;

                    handleConfigRequest(host, function(err, configArray) {

                        if (err) {
                            res.send({
                                "ok": false,
                                "message": err.message
                            });
                            res.end();
                            return;
                        }

                        // respond with the json array
                        res.send(configArray);
                        res.end();
                    });

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
