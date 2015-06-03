var path = require('path');
var util = require("../../util/util");

var multistore = require("../stores/multistore");

exports = module.exports = function()
{
    var CACHED_ADAPTERS = {};

    var bindConfigAdapter = function(configStore, callback)
    {
        var adapter = CACHED_ADAPTERS[configStore.id];
        if (adapter)
        {
            callback(null, adapter);
        }
        else
        {
            require("./adapter")(configStore).init(function(err, adapter) {

                if (err)
                {
                    callback(err);
                    return;
                }

                CACHED_ADAPTERS[configStore.id] = adapter;

                callback(null, adapter);
            });
        }
    };

    var handleConfigRequest = function(configStore, callback)
    {
        // now bind adapter
        bindConfigAdapter(configStore, function(err, adapter) {

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

                adapter.loadBlocks(function(blockConfigs) {

                    for (var blockKey in blockConfigs)
                    {
                        array.push(blockConfigs[blockKey]);
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

                                // allow for page config to specify evaluator and condition
                                if (pageConfig.page.evaluator) {
                                    r.evaluator = pageConfig.page.evaluator;
                                }
                                if (pageConfig.page.condition) {
                                    r.condition = pageConfig.page.condition;
                                }

                                array.push(r);
                            }

                            var p = {};
                            p.evaluator = "page";
                            p.condition = pageKey;
                            p.config = {
                                "pages": {
                                }
                            };

                            // allow for page config to specify evaluator and condition
                            if (pageConfig.page.evaluator) {
                                p.evaluator = pageConfig.page.evaluator;
                            }
                            if (pageConfig.page.condition) {
                                p.condition = pageConfig.page.condition;
                            }

                            // need to make a copy here since we're about to delete elements
                            p.config.pages[pageKey] = JSON.parse(JSON.stringify(pageConfig.page));
                            delete p.config.pages[pageKey].bindings;
                            delete p.config.pages[pageKey].gadgets;
                            delete p.config.pages[pageKey].evaluator;
                            delete p.config.pages[pageKey].condition;
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
        return util.createHandler("config", function(req, res, next, configuration, stores) {

            var configStore = stores.config;

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_config") === 0)
                {
                    // for any "modules" that are enabled based on virtual hosts, mount a config store per module
                    // (if a config directory exists)
                    var moduleConfigStores = [];

                    // then wrap into a single multi-store wrapper
                    var stores = [];
                    for (var i = 0; i < moduleConfigStores.length; i++)
                    {
                        stores.push(moduleConfigStores[i]);
                    }
                    stores.push(configStore);

                    var multiStore = multistore(stores);

                    handleConfigRequest(multiStore, function(err, configArray) {

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
        });
    };

    return r;
}();
