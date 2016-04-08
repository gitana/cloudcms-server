var path = require('path');
var util = require("../../util/util");
var async = require("async");

var multistoreFactory = require("../stores/multistore");

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

    var bindDynamicConfigStore = function(req, configuration, dynamicId, callback)
    {
        /**
         * Indicates whether the dynamic config for a given ID has already been faulted from Cloud CMS.
         *
         * This simply looks at the disk and sees whether a dynamic.json file exists.
         *
         * If it does, then we do not bother.
         * If the file does not exist, then we signal that we need to pull stuff down.
         *
         * @param req
         * @param rootStore
         * @param directoryPath
         * @param dynamicId
         * @param callback
         */
        var isDynamicConfigFaulted = function(req, rootStore, directoryPath, dynamicId, callback)
        {
            var dynamicJsonPath = path.join(directoryPath, "/dynamic.json");

            rootStore.existsFile(dynamicJsonPath, function (exists) {
                callback(null, exists);
            });
        };

        /**
         * Indicates whether the dynamic.json file on disk claims that YES there are dynamic config elements on disk
         * or NO, nothing was found on a previous check.
         *
         * @param req
         * @param rootStore
         * @param directoryPath
         * @param dynamicId
         * @param callback
         */
        var isDynamicConfigAvailable = function(req, rootStore, directoryPath, dynamicId, callback)
        {
            var dynamicJsonPath = path.join(directoryPath, "/dynamic.json");

            rootStore.readFile(dynamicJsonPath, function(err, data) {

                if (err) {
                    return callback({
                        "message": "Error loading dynamic.json from disk"
                    });
                }

                var dynamicJson = JSON.parse("" + data);

                callback(null, dynamicJson.exists);
            });
        };

        var removeOldDynamicConfigDirectory = function(req, rootStore, directoryPath, done)
        {
            // remove and/or re-create the directory
            rootStore.existsDirectory(directoryPath, function(exists) {

                if (!exists) {
                    return done();
                }

                rootStore.removeDirectory(directoryPath, function (err) {
                    done(err);
                });
            });
        };

        var faultDynamicConfig = function(req, rootStore, directoryPath, dynamicId, done) {

            // if there is an old dynamic config directory sitting around, we remove it
            removeOldDynamicConfigDirectory(req, rootStore, directoryPath, function(err) {

                // query to see if there are any dynamic config for this
                req.application(function(err, application) {

                    if (err) {
                        return done();
                    }

                    if (!application) {
                        return done();
                    }

                    var dynamicConfig = null;

                    Chain(application).querySettings({
                        "key": dynamicId,
                        "scope": "dynamic-config"
                    }, {
                        "limit": -1
                    }).each(function() {
                        dynamicConfig = this;
                    }).then(function() {

                        var dynamicJson = {
                            "exists": (dynamicConfig ? true : false)
                        };

                        // write dynamic config
                        var dynamicJsonPath = path.join(directoryPath, "/dynamic.json");
                        rootStore.writeFile(dynamicJsonPath, JSON.stringify(dynamicJson, null, "  "), function(err) {

                            if (!dynamicJson)
                            {
                                return done();
                            }

                            writeDynamicConfig(req, rootStore, directoryPath, dynamicId, dynamicConfig, function(err) {

                                if (err) {
                                    return done(err, false);
                                }

                                // available!
                                done(null, true);
                            });
                        });

                    });

                });

            });
        };

        var writeDynamicConfig = function(req, rootStore, directoryPath, dynamicId, config, finished)
        {
            var fns = [];

            var blocks = config.settings.config.blocks;

            if (blocks)
            {
                for (var i = 0; i < blocks.length; i++)
                {
                    var blockId = "block" + i;

                    var fn = function(rootStore, directoryPath, blockId, block) {
                        return function(done) {

                            var blockFilePath = path.join(directoryPath, "config", dynamicId, "blocks", blockId, blockId + ".json");
                            //console.log("Writing block: " + blockFilePath);
                            rootStore.writeFile(blockFilePath, JSON.stringify(block, null, "  "), function(err) {
                                done(err);
                            });
                        };
                    }(rootStore, directoryPath, blockId, blocks[i]);
                    fns.push(fn);
                }
            }

            async.series(fns, function() {
                finished();
            });
        };

        var rootStore = req.stores.root;
        var directoryPath = "dynamic-config/" + dynamicId;

        isDynamicConfigFaulted(req, rootStore, directoryPath, dynamicId, function(err, faulted) {

            if (!faulted)
            {
                // we've made no attempt to load to disk, so let's go for it
                faultDynamicConfig(req, rootStore, directoryPath, dynamicId, function(err, available) {

                    if (err) {
                        return callback(err);
                    }

                    if (!available) {
                        return callback();
                    }

                    // it's available on disk, so let's hand back the mounted dynamic store
                    callback(null, rootStore.mount(path.join(directoryPath, "config")));
                });

                return;
            }

            // check whether the stuff loaded down to disk is available, meaning that we found something worth
            // mounting in the first place
            isDynamicConfigAvailable(req, rootStore, directoryPath, dynamicId, function(err, available) {

                if (err) {
                    return callback(err);
                }

                if (!available) {
                    return callback();
                }

                // yes it's available on disk, so let's hand back the mounted dynamic store
                callback(null, rootStore.mount(path.join(directoryPath, "config")));
            });

        });
    };

    var handleConfigRequest = function(req, configStore, callback) {

        // now bind adapter
        bindConfigAdapter(configStore, function(err, adapter) {

            if (err) {
                return callback({
                    "message": "Unable to bind config adapter, err: " + JSON.stringify(err)
                });
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
     * Dynamic Configuration Interceptor
     *
     * Checks to see if there is any dynamic config to be loaded and if so, makes sure the dynamic config
     * is loaded down to disk.  Once on disk, a dynamic config store is mounted and the req.stores.config store
     * is replaced with a multistore that layers the dynamic config on top.
     */
    r.dynamicConfigurationInterceptor = function()
    {
        if (!process.configuration.config) {
            process.configuration.config = {};
        }

        if (typeof(process.configuration.config.dynamic) === "undefined") {
            process.configuration.config.dynamic = {};
        }

        if (typeof(process.configuration.config.dynamic.enabled) === "undefined") {
            process.configuration.config.dynamic.enabled = false;
        }

        if (process.env.CLOUDCMS_CONFIG_DYNAMIC_ENABLE === "true")
        {
            process.configuration.config.dynamic.enabled = true;
        }

        return util.createInterceptor("config", "config", function(req, res, next, stores, cache, configuration) {

            var handle = false;
            if (configuration.dynamic && configuration.dynamic.enabled)
            {
                handle = true;
            }

            if (!handle)
            {
                return next();
            }

            var dynamicId = req.query["dynamic"];
            if (!dynamicId) {
                return next();
            }

            bindDynamicConfigStore(req, configuration, dynamicId, function(err, dynamicConfigStore) {

                if (err) {
                    return next();
                }

                if (!dynamicConfigStore) {
                    return next();
                }

                var newStores = [req.stores.config];

                if (dynamicConfigStore)
                {
                    newStores.push(dynamicConfigStore);
                }

                // re-wrap the config store with our dynamic config store at the end
                req.stores.config = multistoreFactory(newStores);

                next();

            });

        });
    };

    /**
     * Retrieves configuration for the application.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        // bind listeners for broadcast events
        bindSubscriptions();

        // config handler
        return util.createHandler("config", function(req, res, next, stores, cache, configuration) {

            var configStore = stores.config;

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_config") === 0)
                {
                    handleConfigRequest(req, configStore, function(err, configArray) {

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

    r.invalidateAdapter = function(configStore)
    {
        var adapter = CACHED_ADAPTERS[configStore.id];
        if (adapter)
        {
            delete CACHED_ADAPTERS[configStore.id];
        }
    };

    var bindSubscriptions = function()
    {
        if (process.broadcast)
        {
            // listen for node invalidation events
            process.broadcast.subscribe("module-invalidation-topic", function (message, done) {

                var command = message.command;
                var host = message.host;

                handleModuleInvalidation(host, function(err) {

                    if (!err) {
                        console.log("ConfigService invalidated host: " + host);
                    }

                    done(err);
                });
            });
        }
    };

    var handleModuleInvalidation = function(host, callback)
    {
        var stores = require("../stores/stores");
        stores.produce(host, function (err, stores) {

            if (err) {
                done(err);
                return;
            }

            var configStore = stores.config;

            delete CACHED_ADAPTERS[configStore.id];

            callback();
        });
    };

    return r;
}();
