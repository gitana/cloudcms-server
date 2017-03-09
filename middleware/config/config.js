var path = require('path');
var util = require("../../util/util");
var async = require("async");

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

    var retrieveConfigApplication = function(req, configuration, callback) {

        if (req._config_application) {
            return callback(null, Chain(req._config_application));
        }

        // if not told otherwise, assume "oneteam"
        var appKey = "oneteam";
        if (configuration.remote && configuration.remote.appKey) {
            appKey = configuration.remote.appKey;
        }

        Chain(req.gitana.platform()).readApplication(appKey).then(function() {
            req._config_application = this;
            callback(null, this);
        });

    };

    var bindUIConfigStore = function(req, configuration, uiConfigId, callback)
    {
        /**
         * Indicates whether the ui config for a given ID has already been faulted from Cloud CMS.
         *
         * This simply looks at the disk and sees whether a uiconfig.json file exists.
         *
         * If it does, then we do not bother.
         * If the file does not exist, then we signal that we need to pull stuff down.
         *
         * @param req
         * @param rootStore
         * @param directoryPath
         * @param uiConfigId
         * @param callback
         */
        var isUIConfigAlreadyFaulted = function(req, rootStore, directoryPath, uiConfigId, callback)
        {
            // if we're running in development, always consider it NOT faulted
            if (process.env.CLOUDCMS_APPSERVER_MODE !== "production") {
                return callback(null, false);
            }

            var uiConfigJsonPath = path.join(directoryPath, "/uiconfig.json");

            rootStore.existsFile(uiConfigJsonPath, function (exists) {
                callback(null, exists);
            });
        };

        /**
         * Indicates whether the uiconfig.json file on disk claims that YES there are ui config elements on disk
         * or NO, nothing was found on a previous check.
         *
         * @param req
         * @param rootStore
         * @param directoryPath
         * @param uiConfigId
         * @param callback
         */
        var isUIConfigAvailable = function(req, rootStore, directoryPath, uiConfigId, callback)
        {
            var uiConfigJsonPath = path.join(directoryPath, "/uiconfig.json");

            rootStore.readFile(uiConfigJsonPath, function(err, data) {

                if (err) {
                    return callback({
                        "message": "Error loading uiconfig.json from disk"
                    });
                }

                var uiConfigJson = JSON.parse("" + data);

                callback(null, uiConfigJson.exists);
            });
        };

        var removeOldUIConfigDirectory = function(req, rootStore, directoryPath, done)
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

        var faultUIConfig = function(req, rootStore, directoryPath, uiConfigId, done) {

            // if there is an old ui config directory sitting around, we remove it
            removeOldUIConfigDirectory(req, rootStore, directoryPath, function(err) {

                // query to see if there are any ui config for this
                Chain(req.gitana.platform()).readUIConfig(uiConfigId).then(function() {

                    var uiConfig = this;

                    var uiConfigJson = {
                        "exists": (uiConfig ? true : false)
                    };

                    // console.log("DOWNLOADED: " + JSON.stringify(uiConfig, null, "  "));

                    // write ui config
                    var uiConfigJsonPath = path.join(directoryPath, "/uiconfig.json");
                    rootStore.writeFile(uiConfigJsonPath, JSON.stringify(uiConfigJson, null, "  "), function(err) {

                        if (!uiConfigJson)
                        {
                            return done();
                        }

                        writeUIConfigToDisk(req, rootStore, directoryPath, uiConfigId, uiConfig, function(err) {

                            if (err) {
                                return done(err, false);
                            }

                            // available!
                            done(null, true);
                        });
                    });

                });

            });
        };

        var writeUIConfigToDisk = function(req, rootStore, directoryPath, uiConfigId, uiConfig, finished)
        {
            var fns = [];

            var blocks = null;
            if (uiConfig.config)
            {
                blocks = uiConfig.config.blocks;
            }

            if (blocks)
            {
                for (var i = 0; i < blocks.length; i++)
                {
                    var blockId = "block" + i;

                    var fn = function(rootStore, directoryPath, blockId, block) {
                        return function(done) {

                            var blockFilePath = path.join(directoryPath, "config", uiConfigId, "blocks", blockId, blockId + ".json");

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
        var directoryPath = "uiconfigs/" + uiConfigId;

        isUIConfigAlreadyFaulted(req, rootStore, directoryPath, uiConfigId, function(err, faulted) {

            if (!faulted)
            {
                // we've made no attempt to load to disk, so let's go for it
                faultUIConfig(req, rootStore, directoryPath, uiConfigId, function(err, available) {

                    if (err) {
                        return callback(err);
                    }

                    if (!available) {
                        return callback();
                    }

                    // it's available on disk, so let's hand back the mounted ui config store
                    callback(null, rootStore.mount(path.join(directoryPath, "config")));
                });

                return;
            }

            // check whether the stuff loaded down to disk is available, meaning that we found something worth
            // mounting in the first place
            isUIConfigAvailable(req, rootStore, directoryPath, uiConfigId, function(err, available) {

                if (err) {
                    return callback(err);
                }

                if (!available) {
                    return callback();
                }

                // yes it's available on disk, so let's hand back the mounted ui config store
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
     * UI Configuration Interceptor for Users
     *
     * Given a user ID, looks up their application user settings and figures out which ui config to use.
     * Substitutes req.query.id into the request.
     */
    r.userRemoteConfigInterceptor = function()
    {
        return util.createInterceptor("userRemoteConfig", "config", function(req, res, next, stores, cache, configuration) {

            var handle = false;
            if (configuration.remote && configuration.remote.enabled)
            {
                handle = true;
            }

            if (!handle)
            {
                return next();
            }

            handle = false;
            if (req.url.indexOf("/_config/remote") === 0)
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

            // get the cloud cms application
            retrieveConfigApplication(req, configuration, function(err, application) {

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

                    var uiconfigs = userSettings.settings.uiconfigs;
                    if (!uiconfigs) {
                        return next();
                    }

                    var id = uiconfigs["platform"];

                    if (projectId)
                    {
                        id = uiconfigs["project-" + projectId];
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
     * Remote Configuration Interceptor
     *
     * If a remote configuration ID is provided (req.query.id), this will fault that configuration to disk
     * (unless it is already faulted) and mount a store.  The store is kept around as req._remote_config_store.
     */
    r.remoteConfigInterceptor = function()
    {
        return util.createInterceptor("remoteConfig", "config", function(req, res, next, stores, cache, configuration) {

            var handle = false;
            if (configuration.remote && configuration.remote.enabled)
            {
                handle = true;
            }

            if (!handle)
            {
                return next();
            }

            if (req.url.indexOf("/_config") !== 0)
            {
                return next();
            }

            var uiConfigId = req.query["id"];
            if (!uiConfigId) {
                return next();
            }

            bindUIConfigStore(req, configuration, uiConfigId, function(err, uiConfigStore) {

                if (err) {
                    return next();
                }

                if (!uiConfigStore) {
                    return next();
                }

                req._remote_config_store = uiConfigStore;

                next();

            });

        });
    };

    /**
     * Retrieves static configuration.
     *
     * This serves back using the mounted config store (which is a multistore).
     *
     * @return {Function}
     */
    r.staticConfigHandler = function()
    {
        if (!process.configuration.config) {
            process.configuration.config = {};
        }

        if (typeof(process.configuration.config.remote) === "undefined") {
            process.configuration.config.remote = {};
        }

        if (typeof(process.configuration.config.remote.enabled) === "undefined") {
            process.configuration.config.remote.enabled = false;
        }

        if (process.env.CLOUDCMS_CONFIG_REMOTE_ENABLED === "true")
        {
            process.configuration.config.remote.enabled = true;
        }

        if (typeof(process.configuration.config.remote.appKey) === "undefined")
        {
            if (process.env.CLOUDCMS_CONFIG_REMOTE_APPKEY)
            {
                process.configuration.config.remote.appKey = process.env.CLOUDCMS_CONFIG_REMOTE_APPKEY;
            }
        }

        // bind listeners for broadcast events
        bindSubscriptions();

        // config handler
        return util.createHandler("staticConfig", "config", function(req, res, next, stores, cache, configuration) {

            var configStore = stores.config;

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_config/static") === 0)
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

    /**
     * Retrieves remote configuration.
     *
     * This serves back using the user configuration store (which is per user).
     *
     * @return {Function}
     */
    r.remoteConfigHandler = function()
    {
        // config handler
        return util.createHandler("remoteConfig", "config", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_config/remote") === 0)
                {
                    if (!req._remote_config_store) {
                        res.send([]);
                        return res.end();
                    }

                    handleConfigRequest(req, req._remote_config_store, function(err, configArray) {

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


    var invalidateAdapter = r.invalidateAdapter = function(configStore)
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
            process.broadcast.subscribe("module-invalidation-topic", function (message, channel, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                var command = message.command;
                var host = message.host;

                handleModuleInvalidation(host, function(err) {

                    if (!err) {
                        console.log("ConfigService invalidated host: " + host);
                    }

                    invalidationDone(err);
                });
            });

            // listen for uiconfig being invalidated
            process.broadcast.subscribe("uiconfig_invalidation", function (message, channel, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                //var command = message.command;
                var host = message.host;
                var id = message.id;

                handleUIConfigInvalidation(host, id, function(err) {

                    if (!err) {
                        console.log("Invalidated remote ui config, host: " + host + ", id: " + id);
                    }

                    invalidationDone(err);
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

    var handleUIConfigInvalidation = function(host, uiConfigId, callback)
    {
        invalidateUIConfig(host, uiConfigId, function(err) {

            if (err) {
                console.log(err);
            }

            // swallow error
            callback();
        });
    };

    var invalidateUIConfig = r.invalidateUIConfig = function(host, uiConfigId, callback)
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
            var directoryPath = "uiconfigs/" + uiConfigId;

            rootStore.removeDirectory(directoryPath, function(err) {

                var uiConfigStore = rootStore.mount(path.join(directoryPath, "config"));
                console.log("remove adapter: " + uiConfigStore.id);
                invalidateAdapter(uiConfigStore);

                callback(err);
            });

        });
    };

    return r;
}();
