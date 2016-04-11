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

    var retrieveOverlayConfigApplication = function(req, configuration, callback) {

        if (req._overlay_config_application) {
            return callback(null, Chain(req._overlay_config_application));
        }

        // if not told otherwise, assume "oneteam"
        var appKey = "oneteam";
        if (configuration.overlay && configuration.overlay.appKey) {
            appKey = configuration.overlay.appKey;
        }

        Chain(req.gitana.platform()).readApplication(appKey).then(function() {
            req._overlay_config_application = this;
            callback(null, this);
        });

    };

    var bindOverlayConfigStore = function(req, configuration, overlayId, callback)
    {
        /**
         * Indicates whether the overlay config for a given ID has already been faulted from Cloud CMS.
         *
         * This simply looks at the disk and sees whether a overlay.json file exists.
         *
         * If it does, then we do not bother.
         * If the file does not exist, then we signal that we need to pull stuff down.
         *
         * @param req
         * @param rootStore
         * @param directoryPath
         * @param overlayId
         * @param callback
         */
        var isOverlayConfigFaulted = function(req, rootStore, directoryPath, overlayId, callback)
        {
            var overlayJsonPath = path.join(directoryPath, "/overlay.json");

            rootStore.existsFile(overlayJsonPath, function (exists) {
                callback(null, exists);
            });
        };

        /**
         * Indicates whether the overlay.json file on disk claims that YES there are overlay config elements on disk
         * or NO, nothing was found on a previous check.
         *
         * @param req
         * @param rootStore
         * @param directoryPath
         * @param overlayId
         * @param callback
         */
        var isOverlayConfigAvailable = function(req, rootStore, directoryPath, overlayId, callback)
        {
            var overlayJsonPath = path.join(directoryPath, "/overlay.json");

            rootStore.readFile(overlayJsonPath, function(err, data) {

                if (err) {
                    return callback({
                        "message": "Error loading overlay.json from disk"
                    });
                }

                var overlayJson = JSON.parse("" + data);

                callback(null, overlayJson.exists);
            });
        };

        var removeOldOverlayConfigDirectory = function(req, rootStore, directoryPath, done)
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

        var faultOverlayConfig = function(req, rootStore, directoryPath, overlayId, done) {

            // if there is an old overlay config directory sitting around, we remove it
            removeOldOverlayConfigDirectory(req, rootStore, directoryPath, function(err) {

                // query to see if there are any overlay config for this
                retrieveOverlayConfigApplication(req, configuration, function(err, application) {

                    if (err) {
                        return done();
                    }

                    if (!application) {
                        return done();
                    }

                    var overlayConfig = null;

                    Chain(application).querySettings({
                        "key": overlayId,
                        "scope": "overlay"
                    }, {
                        "limit": -1
                    }).each(function() {
                        overlayConfig = this;
                    }).then(function() {

                        var overlayJson = {
                            "exists": (overlayConfig ? true : false)
                        };

                        // write overlay config
                        var overlayJsonPath = path.join(directoryPath, "/overlay.json");
                        rootStore.writeFile(overlayJsonPath, JSON.stringify(overlayJson, null, "  "), function(err) {

                            if (!overlayJson)
                            {
                                return done();
                            }

                            writeOverlayConfig(req, rootStore, directoryPath, overlayId, overlayConfig, function(err) {

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

        var writeOverlayConfig = function(req, rootStore, directoryPath, overlayId, config, finished)
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

                            var blockFilePath = path.join(directoryPath, "config", overlayId, "blocks", blockId, blockId + ".json");
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
        var directoryPath = "overlays/" + overlayId;

        isOverlayConfigFaulted(req, rootStore, directoryPath, overlayId, function(err, faulted) {

            if (!faulted)
            {
                // we've made no attempt to load to disk, so let's go for it
                faultOverlayConfig(req, rootStore, directoryPath, overlayId, function(err, available) {

                    if (err) {
                        return callback(err);
                    }

                    if (!available) {
                        return callback();
                    }

                    // it's available on disk, so let's hand back the mounted overlay config store
                    callback(null, rootStore.mount(path.join(directoryPath, "config")));
                });

                return;
            }

            // check whether the stuff loaded down to disk is available, meaning that we found something worth
            // mounting in the first place
            isOverlayConfigAvailable(req, rootStore, directoryPath, overlayId, function(err, available) {

                if (err) {
                    return callback(err);
                }

                if (!available) {
                    return callback();
                }

                // yes it's available on disk, so let's hand back the mounted overlay config store
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
     * Overlay Configuration Interceptor for Users
     *
     * Given a user ID, looks up their application user settings and figures out which overlay-config to use.
     * Substitutes req.query.overlayId into the request.
     */
    r.overlayUserConfigurationInterceptor = function()
    {
        return util.createInterceptor("config", "config", function(req, res, next, stores, cache, configuration) {

            var handle = false;
            if (configuration.overlay && configuration.overlay.enabled)
            {
                handle = true;
            }

            if (!handle)
            {
                return next();
            }

            handle = false;
            if (req.url.indexOf("/_config") === 0)
            {
                handle = true;
            }

            if (!handle)
            {
                return next();
            }

            var userId = req.query["userId"];
            if (!userId) {
                return next();
            }

            var a = userId.indexOf("/");
            if (a > -1) {
                userId = userId.substring(a + 1);
            }

            var projectId = req.query["projectId"];

            retrieveOverlayConfigApplication(req, configuration, function(err, application) {

                var userSettings = null;

                // find the settings for the given user id
                Chain(application).querySettings({
                    "key": userId,
                    "scope": "user"
                }, {
                    "limit": -1
                }).each(function () {
                    userSettings = this;
                }).then(function () {

                    if (!userSettings || !userSettings.settings) {
                        return next();
                    }

                    var overlays = userSettings.settings.overlays;
                    if (!overlays) {
                        return next();
                    }

                    var id = null;

                    if (projectId)
                    {
                        id = overlays["project-" + projectId];
                    }
                    else
                    {
                        id = overlays["platform"];
                    }

                    if (!id) {
                        return next();
                    }

                    // adjust request
                    req.query.id = id;

                    // carry on
                    next();
                });
            });

        });
    };

    /**
     * Overlay Configuration Interceptor
     *
     * Checks to see if there is any overlay config to be loaded and if so, makes sure the overlay config
     * is loaded down to disk.  Once on disk, a overlay config store is mounted and the req.stores.config store
     * is replaced with a multistore that layers the overlay config on top.
     */
    r.overlayConfigurationInterceptor = function()
    {
        if (!process.configuration.config) {
            process.configuration.config = {};
        }

        if (typeof(process.configuration.config.overlay) === "undefined") {
            process.configuration.config.overlay = {};
        }

        if (typeof(process.configuration.config.overlay.enabled) === "undefined") {
            process.configuration.config.overlay.enabled = false;
        }

        if (process.env.CLOUDCMS_CONFIG_OVERLAY_ENABLE === "true")
        {
            process.configuration.config.overlay.enabled = true;
        }

        return util.createInterceptor("config", "config", function(req, res, next, stores, cache, configuration) {

            var handle = false;
            if (configuration.overlay && configuration.overlay.enabled)
            {
                handle = true;
            }

            if (!handle)
            {
                return next();
            }

            handle = false;
            if (req.url.indexOf("/_config") === 0)
            {
                handle = true;
            }

            if (!handle)
            {
                return next();
            }

            var overlayId = req.query["id"];
            if (!overlayId) {
                return next();
            }

            bindOverlayConfigStore(req, configuration, overlayId, function(err, overlayConfigStore) {

                if (err) {
                    return next();
                }

                if (!overlayConfigStore) {
                    return next();
                }

                var newStores = [];

                // assume req.stores.config is a multistore already
                var originalStores = req.stores.config.getOriginalStores();
                for (var i = 0; i < originalStores.length; i++)
                {
                    newStores.push(originalStores[i]);
                }

                if (overlayConfigStore)
                {
                    newStores.push(overlayConfigStore);
                }

                // re-wrap the config store with these new stores
                // they include the overlay config store at the end
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

            // list for settings being invalidated
            process.broadcast.subscribe("settings_invalidation", function (message, done) {

                //var command = message.command;
                var host = message.host;
                var applicationId = message.applicationId;
                var settingsKey = message.settingsKey;
                var settingsScope = message.settingsScope;

                if (!settingsKey || !settingsScope) {
                    return done();
                }

                if (settingsScope !== "overlay") {
                    return done();
                }

                handleOverlayConfigInvalidation(host, settingsKey, function(err) {

                    if (!err) {
                        console.log("Invalidated overlay, host: " + host + ", key: " + settingsKey);
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
                return callback(err);
            }

            var configStore = stores.config;

            delete CACHED_ADAPTERS[configStore.id];

            callback();
        });
    };

    var handleOverlayConfigInvalidation = function(host, overlayId, callback)
    {
        invalidateOverlayConfig(host, overlayId, function(err) {

            if (err) {
                console.log(err);
            }

            // swallow error
            callback();
        });
    };

    var invalidateOverlayConfig = r.invalidateOverlayConfig = function(host, overlayId, callback)
    {
        if (!host) {
            return callback({
                "message": "Missing host"
            });
        }

        var stores = require("../stores/stores");
        stores.produce(host, function (err, stores) {

            if (err) {
                return callback(err);
            }

            var rootStore = stores.root;
            var directoryPath = "overlays/" + overlayId;

            rootStore.removeDirectory(directoryPath, function(err) {
                callback(err);
            });

        });
    };

    return r;
}();
