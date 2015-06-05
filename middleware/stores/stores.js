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
    var MODULE_DESCRIPTORS_BY_HOST = {};

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

    var produce = r.produce = function(host, offsetPath, callback)
    {
        if (typeof(offsetPath) === "function")
        {
            callback = offsetPath;
            offsetPath = null;
        }

        var stores = {};
        stores["root"] = buildStore("root", host);

        // assume a few things...
        stores["content"] = buildStore("content", host, "content");
        stores["modules"] = buildStore("modules", host, "modules");

        // these will get overwritten in the binding methods below
        stores["config"] = buildStore("config", host, "config");
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
            var findModuleDescriptors = function(callback)
            {
                var moduleDescriptors = [];

                // look for any module.json files in the modules store
                // these indicate module mount points
                stores.modules.matchFiles("/", "module.json", function(err, moduleJsonFilePaths) {

                    // collect matching paths
                    for (var i = 0; i < moduleJsonFilePaths.length; i++)
                    {
                        var moduleDirectoryPath = path.dirname(moduleJsonFilePaths[i]);

                        moduleDescriptors.push({
                            "path": path.join("modules", moduleDirectoryPath),
                            "store": "modules"
                        });

                        //console.log("Adding modules:module.json for path: " + moduleDirectoryPath);
                    }

                    // look for any module.json files in the web store
                    // these indicate module mount points
                    stores.web.matchFiles("/", "module.json", function(err, moduleJsonFilePaths) {

                        // collect matching paths
                        for (var i = 0; i < moduleJsonFilePaths.length; i++)
                        {
                            var moduleDirectoryPath = path.dirname(moduleJsonFilePaths[i]);

                            if (stores.web.publicDir)
                            {
                                moduleDirectoryPath = path.join(stores.web.publicDir, moduleDirectoryPath);
                            }

                            moduleDescriptors.push({
                                "path": path.join(moduleDirectoryPath),
                                "store": "web"
                            });

                            //console.log("Adding web:module.json for path: " + moduleDirectoryPath);
                        }

                        callback(moduleDescriptors);
                    });
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

            var bindConfigStores = function(moduleDescriptors, callback)
            {
                // all config stores
                var configStores = [];
                for (var i = 0; i < moduleDescriptors.length; i++)
                {
                    var moduleStore = moduleDescriptors[i].store;
                    var modulePath = moduleDescriptors[i].path;

                    var configStore = buildStore(moduleStore, host, path.join(modulePath, "config"));
                    configStores.push(configStore);
                }

                // trim back and only keep stores that are allocated
                retainAllocatedStores(configStores, function(err, allocatedStores) {

                    // all stores to be bound in
                    var bindingStores = [];
                    bindingStores.push(stores.config);
                    for (var i = 0; i < allocatedStores.length; i++) {
                        bindingStores.push(allocatedStores[i]);
                    }

                    /*
                    // debug
                    for (var z = 0; z < bindingStores.length; z++)
                    {
                        console.log("Config Store: " + bindingStores[z].id);
                    }
                    */

                    // bind into a multi-store
                    stores["config"] = require("./multistore")(bindingStores);

                    callback();
                });
            };

            var bindTemplateStores = function(moduleDescriptors, callback)
            {
                // all template stores
                var templateStores = [];
                for (var i = 0; i < moduleDescriptors.length; i++)
                {
                    var moduleStore = moduleDescriptors[i].store;
                    var modulePath = moduleDescriptors[i].path;

                    var templateStore = buildStore(moduleStore, host, path.join(modulePath, "/templates"));
                    templateStores.push(templateStore);
                }

                // trim back and only keep stores that are allocated
                retainAllocatedStores(templateStores, function(err, allocatedStores) {

                    // all stores to be bound in
                    var bindingStores = [];
                    for (var i = 0; i < allocatedStores.length; i++) {
                        bindingStores.push(allocatedStores[i]);
                    }
                    bindingStores.push(stores.templates);

                    /*
                    // debug
                    for (var z = 0; z < bindingStores.length; z++)
                    {
                        console.log("Template Store: " + bindingStores[z].id);
                    }
                    */

                    // bind into a multi-store
                    stores["templates"] = require("./multistore")(bindingStores);

                    callback();
                });
            };

            var moduleDescriptors = MODULE_DESCRIPTORS_BY_HOST[host];
            if (!moduleDescriptors)
            {
                findModuleDescriptors(function(moduleDescriptors) {

                    MODULE_DESCRIPTORS_BY_HOST[host] = moduleDescriptors;

                    bindConfigStores(moduleDescriptors, function () {
                        bindTemplateStores(moduleDescriptors, function() {
                            done();
                        });
                    });

                });
            }
            else
            {
                bindConfigStores(moduleDescriptors, function() {
                    bindTemplateStores(moduleDescriptors, function() {
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

    r.invalidate = function(host)
    {
        delete MODULE_DESCRIPTORS_BY_HOST[host];
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
