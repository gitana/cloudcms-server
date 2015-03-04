var path = require('path');
var util = require("../../util/util");
var async = require("async");

/**
 * Binds the following stores into place:
 *
 *   "root"         the file system root for the deployed or local application
 *   "cache"        the root of the cache
 *   "config"       the configuration storage location
 *   "public"       the web host root (this might be public_build too)
 *   "templates"    the templates storage location (for client-side templates)
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var ENGINES = {};

    // keyed by host
    var MODULE_DIRECTORY_PATHS = [];

    var buildStore = function(storeType, host, offsetPath)
    {
        // figure out which store setup to use
        var storeConfigurationId = process.env.CLOUDCMS_STORE_CONFIGURATION;
        var storeConfiguration = process.configuration.storeConfigurations[storeConfigurationId];
        var engineId = storeConfiguration[storeType];

        var engine = ENGINES[engineId];

        var engineType = process.configuration.storeEngines[engineId].type;
        var engineConfiguration = process.configuration.storeEngines[engineId].config;

        return require("./store")(engine, engineType, engineId, engineConfiguration, host, offsetPath);
    };

    var r = {};

    r.init = function(callback)
    {
        if (!process.env.CLOUDCMS_STORE_CONFIGURATION)
        {
            process.env.CLOUDCMS_STORE_CONFIGURATION = "default";
        }

        // instantiate any engines
        var storeEnginesConfigs = process.configuration.storeEngines;
        for (var engineId in storeEnginesConfigs)
        {
            var storeEngineConfig = storeEnginesConfigs[engineId];

            var engineType = storeEngineConfig.type;
            var engineConfig = storeEngineConfig.config;
            if (!engineConfig) {
                engineConfig = {};
            }

            ENGINES[engineId] = require("./engines/" + engineType)(engineConfig);
        }

        // init all engines
        var fns = [];
        for (var engineId in ENGINES)
        {
            var fn = function(engine) {
                return function(done)
                {
                    engine.init(function(err) {
                        done(err);
                    });
                }
            }(ENGINES[engineId]);
            fns.push(fn);
        }
        async.series(fns, function(errs) {
            var err = null;

            if (errs) {
                for (var i = 0; i < errs.length; i++) {
                    if (errs[i]) {
                        err = errs[i];
                        break;
                    }
                }
            }

            /*
            // on init, produce "{host}" for diagnosis
            produce("<host>", function(err, stores) {

                for (var k in stores)
                {
                    util.log("Store [" + k + "]: " + stores[k].id);
                }

                callback(err);
            });
            */

            callback(err);
        });
    };

    var listHosts = r.listHosts = function(storeId, callback)
    {
        produce("_test_", function(err, stores) {

            var store = stores[storeId];

            if (!store.supportsHosts()) {
                callback(null, []);
                return;
            }

            store.listHosts(function(err, hostnames) {
                callback(null, hostnames);
            });
        });
    };

    var produce = r.produce = function(host, callback)
    {
        var stores = {};
        stores["root"] = buildStore("root", host);

        // assume a few things...
        stores["config"] = buildStore("config", host, "config");
        stores["content"] = buildStore("content", host, "content");
        stores["templates"] = buildStore("templates", host, "templates");

        var bindWebStore = function(done) {

            var webStore = stores["web"] = buildStore("web", host);

            webStore.existsDirectory("public", function(exists) {

                if (exists)
                {
                    stores["web"] = buildStore("web", host, "public");
                    stores["web"].publicDir = "public";
                }

                if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
                {
                    webStore.existsFile("public_build", function (exists) {
                        if (exists)
                        {
                            webStore.listFiles("public_build", function (err, filenames) {

                                if (err) {
                                    done(err);
                                    return;
                                }

                                if (filenames && filenames.length > 0) {
                                    stores["web"] = buildStore("web", host, "public_build");
                                    stores["web"].publicDir = "public_build";
                                }

                                done();
                            });
                        }
                        else
                        {
                            done();
                        }
                    });
                }
                else
                {
                    done();
                }
            });
        };

        var bindModuleStores = function(done)
        {
            var findModuleDirectoryPaths = function(callback)
            {
                // look for any module.json files in the web store
                // these indicate module mount points and should be considered as part of our possible config set
                stores.web.matchFiles("/", "module.json", function(err, moduleJsonFilePaths) {

                    var moduleDirectoryPaths = [];

                    // collect matching paths
                    for (var i = 0; i < moduleJsonFilePaths.length; i++)
                    {
                        var moduleDirectoryPath = path.dirname(moduleJsonFilePaths[i]);

                        moduleDirectoryPaths.push(moduleDirectoryPath);
                    }

                    callback(moduleDirectoryPaths);
                });
            };

            var retainAllocatedStores = function(stores, callback)
            {
                var allocatedStores = [];

                var fns = [];
                for (var i = 0; i < stores.length; i++) {
                    var fn = function (allocatedStores, store) {
                        return function (done) {
                            store.allocated(function(allocated) {
                                if (allocated) {
                                    allocatedStores.push(store);
                                }
                                done();
                            });
                        };
                    }(allocatedStores, stores[i]);
                    fns.push(fn);
                }
                async.series(fns, function (err) {

                    callback(err, allocatedStores);
                });
            };

            var bindConfigStores = function(moduleDirectoryPaths, callback)
            {
                // module-specific config stores
                var moduleStores = [];
                for (var i = 0; i < moduleDirectoryPaths.length; i++)
                {
                    var moduleDirectoryPath = moduleDirectoryPaths[i];
                    if (stores.web.publicDir)
                    {
                        moduleDirectoryPath = path.join(stores.web.publicDir, moduleDirectoryPath);
                    }

                    var moduleStore = buildStore("web", host, moduleDirectoryPath + "/config");
                    moduleStores.push(moduleStore);
                }

                // trim back and only keep stores that are allocated
                retainAllocatedStores(moduleStores, function(err, allocatedStores) {

                    // all stores to be bound in
                    var bindingStores = [];
                    bindingStores.push(stores.config);
                    for (var i = 0; i < allocatedStores.length; i++) {
                        bindingStores.push(allocatedStores[i]);
                    }

                    // bind into a multi-store
                    stores["config"] = require("./multistore")(bindingStores);

                    callback();
                });
            };

            var bindTemplateStores = function(moduleDirectoryPaths, callback)
            {
                // module-specific template stores
                var moduleStores = [];
                for (var i = 0; i < moduleDirectoryPaths.length; i++)
                {
                    var moduleDirectoryPath = moduleDirectoryPaths[i];
                    if (stores.web.publicDir)
                    {
                        moduleDirectoryPath = path.join(stores.web.publicDir, moduleDirectoryPath);
                    }

                    var moduleStore = buildStore("web", host, moduleDirectoryPath + "/templates");
                    moduleStores.push(moduleStore);
                }

                // trim back and only keep stores that are allocated
                retainAllocatedStores(moduleStores, function(err, allocatedStores) {

                    // all stores to be bound in
                    var bindingStores = [];
                    bindingStores.push(stores.config);
                    for (var i = 0; i < allocatedStores.length; i++) {
                        bindingStores.push(allocatedStores[i]);
                    }

                    // bind into a multi-store
                    stores["templates"] = require("./multistore")(bindingStores);

                    callback();
                });
            };

            var moduleDirectoryPaths = MODULE_DIRECTORY_PATHS[host];
            if (!moduleDirectoryPaths)
            {
                findModuleDirectoryPaths(function(moduleDirectoryPaths) {

                    MODULE_DIRECTORY_PATHS[host] = moduleDirectoryPaths;

                    bindConfigStores(moduleDirectoryPaths, function () {
                        bindTemplateStores(moduleDirectoryPaths, function() {
                            done();
                        });
                    });

                });
            }
            else
            {
                bindConfigStores(moduleDirectoryPaths, function() {
                    bindTemplateStores(moduleDirectoryPaths, function() {
                        done();
                    });
                });

            }
        };

        var bindContentStore = function(done)
        {
            /*
            rootStore.existsFile("content", function(exists) {

                if (exists) {
                    stores["content"] = rootStore.mount("content");
                }

                done();
            });
            */

            stores["content"] = buildStore("content", host, "content");
            done();
        };

        var fns = [];
        fns.push(bindWebStore);
        fns.push(bindModuleStores);
        fns.push(bindContentStore);

        async.series(fns, function() {
            callback(null, stores);
        });
    };

    /**
     * @return {Function}
     */
    r.storesInterceptor = function()
    {
        return function(req, res, next)
        {
            produce(req.domainHost, function(err, stores) {

                req.stores = stores;

                req.rootStore = stores["root"];
                req.configStore = stores["config"];
                req.contentStore = stores["content"];
                req.webStore = stores["web"];

                next();
            });
        };
    };

    return r;
}();
