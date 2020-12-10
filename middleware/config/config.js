var path = require('path');
var util = require("../../util/util");
var async = require("async");
var multistore = require("../stores/multistore");

exports = module.exports = function()
{
    // storeId -> adapter
    var ADAPTERS = {};

    var bindConfigAdapter = function(configStore, callback)
    {
        var adapter = ADAPTERS[configStore.id];
        if (adapter)
        {
            callback(null, adapter);
        }
        else
        {
            require("./adapter")(configStore).init(function(err, adapter) {

                if (err)
                {
                    return callback(err);
                }

                ADAPTERS[configStore.id] = adapter;

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

                var uiConfigJson = util.jsonParse("" + data);

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
                Chain(req.gitana.platform()).trap(function(e) {
                    // failed to read the UI config
                    done({
                        "message": "Unable to read UI config: " + uiConfigId
                    });
                    return false;
                }).readUIConfig(uiConfigId).then(function() {

                    var uiConfig = this;

                    var uiConfigJson = {
                        "exists": (uiConfig ? true : false)
                    };

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
                            p.config.pages[pageKey] = util.clone(pageConfig.page, true);
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

            handle = false;
            if (req.url.indexOf("/_config/remote") === 0)
            {
                handle = true;
            }

            if (!handle)
            {
                return next();
            }

            var principalId = req.query["principalId"];
            if (!principalId) {
                principalId = req.query["userId"];
            }
            if (!principalId) {
                principalId = req.query["groupId"];
            }
            if (principalId)
            {
                var a = principalId.indexOf("/");
                if (a > -1)
                {
                    principalId = principalId.substring(a + 1);
                }
            }

            var projectId = req.query["projectId"];

            var forceInvalidate = (req.query["invalidate"] === "true");

            var includeViews = true;
            var includeSystemManagedUser = true;
            var includeSystemManagedGlobal = true;

            var mode = req.query["mode"];
            if (mode === "global")
            {
                includeViews = false;
                includeSystemManagedGlobal = true;
                includeSystemManagedUser = false;
            }
            else if (mode === "global-and-user")
            {
                includeViews = false;
                includeSystemManagedGlobal = true;
                includeSystemManagedUser = true;
            }

            // get the cloud cms application
            retrieveConfigApplication(req, configuration, function(err, application) {

                // find any settings for the given user or the project (if provided)
                var q = {
                    "$or": []
                };

                if (includeViews)
                {
                    // if a user ID is supplied, we fetch VIEW UI CONFIGs that are explicitly selected within OneTeam UI
                    // these have "scope" user
                    if (principalId)
                    {
                        q["$or"].push({
                            "scope": "user",
                            "key": principalId
                        });
                    }
                }

                if (includeSystemManagedUser)
                {
                    // if a user ID is supplied, we fetch system-managed UI Config for the user
                    // this allows for project or platform specific user customizations
                    // these have scope "principal"
                    if (principalId)
                    {
                        q["$or"].push({
                            "scope": "principal",
                            "key": principalId
                        });
                    }
                }

                if (includeSystemManagedGlobal)
                {
                    // if a project ID is supplied, we fetch system-managed UI Config for project
                    // this allows for global project customizations
                    // these have scope "project"
                    if (projectId)
                    {
                        // these have scope "project"
                        q["$or"].push({
                            "scope": "project",
                            "key": projectId
                        });
                    }
                    else
                    {
                        // if no project ID, we fetch system-managed UI Config for platform
                        // this allows for global platform customization
                        // these have scope "platform"
                        q["$or"].push({
                            "scope": "platform",
                            "key": "platform"
                        });
                    }
                }

                var uiConfigIds = [];

                // find the settings for the given user id
                var settingsList = [];
                Chain(application).querySettings(q, {
                    "limit": 25
                }).each(function () {
                    if (this.settings && this.settings.uiconfigs)
                    {
                        settingsList.push(this);
                    }
                }).then(function() {

                    if (projectId)
                    {
                        // SYSTEM MANAGED: keep IDs for global "project" level
                        for (var i = 0; i < settingsList.length; i++)
                        {
                            if (settingsList[i].scope !== "principal")
                            {
                                if (settingsList[i].settings.uiconfigs.project)
                                {
                                    uiConfigIds.push(settingsList[i].settings.uiconfigs.project);
                                }
                            }
                        }

                        // SYSTEM MANAGED: keep IDs for global project-specific level
                        for (var i = 0; i < settingsList.length; i++)
                        {
                            if (settingsList[i].scope !== "principal")
                            {
                                if (settingsList[i].settings.uiconfigs["project-" + projectId])
                                {
                                    uiConfigIds.push(settingsList[i].settings.uiconfigs["project-" + projectId]);
                                }
                            }
                        }

                        // VIEW: keep IDs for "user" level (specific ONETEAM VIEW selections)
                        for (var i = 0; i < settingsList.length; i++)
                        {
                            if (settingsList[i].scope === "user") {
                                if (settingsList[i].settings.uiconfigs["project-" + projectId]) {
                                    uiConfigIds.push(settingsList[i].settings.uiconfigs["project-" + projectId]);
                                }
                            }
                        }

                        // USER: keep IDs for user "project" level
                        for (var i = 0; i < settingsList.length; i++)
                        {
                            if (settingsList[i].scope === "principal")
                            {
                                if (settingsList[i].settings.uiconfigs.project)
                                {
                                    uiConfigIds.push(settingsList[i].settings.uiconfigs.project);
                                }
                            }
                        }

                        // USER: keep IDs for user project-specific level
                        for (var i = 0; i < settingsList.length; i++)
                        {
                            if (settingsList[i].scope === "principal")
                            {
                                if (settingsList[i].settings.uiconfigs["project-" + projectId])
                                {
                                    uiConfigIds.push(settingsList[i].settings.uiconfigs["project-" + projectId]);
                                }
                            }
                        }
                    }
                    else
                    {
                        // SYSTEM MANAGED: keep IDs for platform level
                        for (var i = 0; i < settingsList.length; i++)
                        {
                            if (settingsList[i].scope !== "principal")
                            {
                                if (settingsList[i].settings.uiconfigs.platform)
                                {
                                    uiConfigIds.push(settingsList[i].settings.uiconfigs.platform);
                                }
                            }
                        }

                        // VIEW: keep IDs for "user" level (specific ONETEAM VIEW selections)
                        for (var i = 0; i < settingsList.length; i++)
                        {
                            if (settingsList[i].scope === "user") {
                                if (settingsList[i].settings.uiconfigs.platform) {
                                    uiConfigIds.push(settingsList[i].settings.uiconfigs.plaform);
                                }
                            }
                        }

                        // USER: keep IDs for platform level
                        for (var i = 0; i < settingsList.length; i++)
                        {
                            if (settingsList[i].scope === "principal")
                            {
                                if (settingsList[i].settings.uiconfigs.platform)
                                {
                                    uiConfigIds.push(settingsList[i].settings.uiconfigs.platform);
                                }
                            }
                        }
                    }

                    var completionFn = function() {

                        // mount 1 store for each ui config
                        var uiConfigStores = [];

                        var fns = [];
                        for (var i = 0; i < uiConfigIds.length; i++)
                        {
                            var fn = function(req, configuration, id, uiConfigStores)
                            {
                                return function(done)
                                {
                                    bindUIConfigStore(req, configuration, id, function(err, s) {

                                        if (err) {
                                            return done();
                                        }

                                        if (!s) {
                                            return done();
                                        }

                                        uiConfigStores.push(s);

                                        done();
                                    });
                                }
                            }(req, configuration, uiConfigIds[i], uiConfigStores);
                            fns.push(fn);
                        }

                        async.series(fns, function() {

                            // the multistore reverses stores, so we have to pre-emptively reverse here
                            uiConfigStores.reverse();

                            // wrap all ui config stores into a single remote config store
                            req._remote_config_store = multistore(uiConfigStores);

                            next();

                        });
                    };

                    if (!forceInvalidate || !uiConfigIds || uiConfigIds.length === 0)
                    {
                        return completionFn();
                    }

                    // process any invalidations first, then proceed
                    var invalidateFns = [];
                    for (var i = 0; i < uiConfigIds.length; i++)
                    {
                        if (req.domainHost)
                        {
                            var invalidateFn = function (host, uiConfigId) {
                                return function (d) {
                                    invalidateUIConfig(host, uiConfigId, function () {
                                        d();
                                    });
                                }
                            }(req.domainHost, uiConfigIds[i]);
                            invalidateFns.push(invalidateFn);
                        }

                        if (req.virtualHost)
                        {
                            var invalidateFn = function (host, uiConfigId) {
                                return function (d) {
                                    invalidateUIConfig(host, uiConfigId, function () {
                                        d();
                                    });
                                }
                            }(req.virtualHost, uiConfigIds[i]);
                            invalidateFns.push(invalidateFn);
                        }
                    }
                    async.parallel(invalidateFns, function() {
                        completionFn();
                    });
                });
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
        var adapter = ADAPTERS[configStore.id];
        if (adapter)
        {
            delete ADAPTERS[configStore.id];
        }
    };

    var bindSubscriptions = function()
    {
        if (process.broadcast)
        {
            // listen for node invalidation events
            process.broadcast.subscribe("module_invalidation", function (message, channel, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                var host = message.host;

                process.log("Invalidating config service for module invalidation, host: " + host);

                invalidateHost(host, function(err) {

                    if (!err) {
                        process.log("ConfigService invalidated host: " + host);
                        process.log(err);
                    }

                    invalidationDone(err);
                });
            });

            // listen for uiconfig being invalidated
            process.broadcast.subscribe("uiconfig_invalidation", function (message, channel, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                var host = message.host;
                var id = message.id;

                process.log("Invalidating config service for uiconfig invalidation, host: " + host + ", id: " + id);

                handleUIConfigInvalidation(host, id, function(err) {

                    if (!err) {
                        process.log("Invalidated remote ui config, host: " + host + ", id: " + id);
                    }

                    invalidationDone(err);
                });

            });
        }
    };

    var invalidateHost = r.invalidateHost = function(host, callback)
    {
        var stores = require("../stores/stores");
        stores.produce(host, function (err, stores) {

            if (err) {
                return callback(err);
            }

            var configStore = stores.config;

            delete ADAPTERS[configStore.id];

            callback();
        });
    };

    var handleUIConfigInvalidation = function(host, uiConfigId, callback)
    {
        invalidateUIConfig(host, uiConfigId, function(err) {

            if (err) {
                process.log(err);
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

            var uiConfigStore = rootStore.mount(path.join(directoryPath, "config"));
            process.log("remove adapter: " + uiConfigStore.id);
            invalidateAdapter(uiConfigStore);

            // walk all adapters and look for any that are mounted on multistores
            // for any found, get original stores and see if our store is among them
            // if so, invalidate the multistore adapters as well
            for (var storeId in ADAPTERS)
            {
                if (storeId.indexOf("multistore://") === 0)
                {
                    var adapter = ADAPTERS[storeId];

                    var match = false;
                    var adapterStore = adapter.getConfigStore();
                    var originalStores = adapterStore.getOriginalStores();
                    for (var i = 0; i < originalStores.length; i++)
                    {
                        if (originalStores[i].id === uiConfigStore.id)
                        {
                            match = true;
                            break;
                        }
                    }

                    if (match)
                    {
                        process.log("remove dependent adapter: " + adapterStore.id);
                        invalidateAdapter(adapterStore);
                    }
                }
            }

            rootStore.removeDirectory(directoryPath, function(err) {
                callback(err);
            });

        });
    };

    return r;
}();
