var path = require('path');
var util = require("../../util/util");
var async = require("async");
var hash = require("object-hash");

var logFactory = require("../../util/logger");

var storesLogger = this.storesLogger = logFactory("stores", { wid: true });

if (typeof(process.env.CLOUDCMS_STORES_LOGGER_LEVEL) !== "undefined") {
    storesLogger.setLevel(("" + process.env.CLOUDCMS_STORES_LOGGER_LEVEL).toLowerCase(), true);
}
else {
    storesLogger.setLevel("info");
}

var log = function(text, level)
{
    storesLogger.log(text, level);
};



/**
 * Binds the following stores into place:
 *
 *   "root"             the file system root for the deployed or local application
 *   "cache"            the root of the cache
 *   "public"           the web host root (this might be public_build too)
 *   "templates"        the templates storage location (for client-side templates)
 *   "modules"          the deployed modules storage location (for client-side modules)
 *   "config"           the configuration storage location for static config (for client-side config)
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var ENGINES = {};

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

        // instantiate any engines that we need
        var storeConfigurationId = process.env.CLOUDCMS_STORE_CONFIGURATION;
        var storeConfiguration = process.configuration.storeConfigurations[storeConfigurationId];
        for (var storeId in storeConfiguration)
        {
            var engineId = storeConfiguration[storeId];

            if (!ENGINES[engineId])
            {
                var storeEngineConfig = process.configuration.storeEngines[engineId];
                var engineType = storeEngineConfig.type;
                var engineConfig = storeEngineConfig.config;
                if (!engineConfig) {
                    engineConfig = {};
                }

                ENGINES[engineId] = require("./engines/" + engineType)(engineConfig);
            }
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

    var _cached_stores = function() {

        var CACHED_STORES_BY_HOST = {};
        var CACHED_STORES_EXPIRATION_MS_BY_HOST = {};
        var TTL_MS = 1000 * 60; // one minute

        return function(host, stores) {

            if (stores === null)
            {
                delete CACHED_STORES_BY_HOST[host];
                delete CACHED_STORES_EXPIRATION_MS_BY_HOST[host];
            }
            else if (stores)
            {
                CACHED_STORES_BY_HOST[host] = stores;
                CACHED_STORES_EXPIRATION_MS_BY_HOST[host] = new Date().getTime() + TTL_MS;
            }

            var val = CACHED_STORES_BY_HOST[host];

            var expTime = CACHED_STORES_EXPIRATION_MS_BY_HOST[host];
            if (expTime && new Date().getTime() > expTime)
            {
                delete CACHED_STORES_BY_HOST[host];
                delete CACHED_STORES_EXPIRATION_MS_BY_HOST[host];
                val = undefined;
            }

            return val;
        }
    }();

    var produce = r.produce = function(host, offsetPath, callback)
    {
        if (typeof(offsetPath) === "function")
        {
            callback = offsetPath;
            offsetPath = null;
        }

        var faultCache = function(host, afterCheck)
        {
            var stores = _cached_stores(host);
            if (!stores) {
                return afterCheck();
            }

            return process.cache.read("module-descriptors-" + host, function(err, moduleDescriptorsForHost) {

                if (err) {
                    return afterCheck(err);
                }

                afterCheck(null, stores, moduleDescriptorsForHost);
            });
        };

        // try to retrieve from cache
        faultCache(host, function(err, stores, moduleDescriptorsForHost) {

            // if we found something, hand it back
            if (stores && typeof(moduleDescriptorsForHost) !== "undefined" && moduleDescriptorsForHost !== null) {
                //console.log("Stores - Cache Hit");
                return callback(null, stores, moduleDescriptorsForHost);
            }

            //console.log("Stores - Cache Miss");

            // generate new stores
            stores = {};
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
                                        return done(err);
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
                    // look for any module.json files in the modules store
                    // these indicate module mount points
                    // this is an expensive lookup in that it goes directory by directory looking for module.json files
                    // in production systems, code should go through a build step that removes extraneous files that were
                    // required in and are no longer needed.
                    stores.modules.matchFiles("/", "module.json", function(err, moduleJsonFilePaths) {

                        // build out module descriptors
                        var moduleDescriptors = [];
                        // functions to run
                        var fns = [];
                        for (var i = 0; i < moduleJsonFilePaths.length; i++)
                        {
                            var fn = function(moduleJsonFilePath) {
                                return function(done) {

                                    // the "match" function above uses regex and could find things like module-json.js, so we filter here
                                    if (!moduleJsonFilePath.toLowerCase().endsWith("module.json"))
                                    {
                                        return done();
                                    }

                                    stores.modules.readFile(moduleJsonFilePath, function(err, data) {

                                        if (err) {
                                            return done();
                                        }

                                        var moduleJson = null;

                                        try
                                        {
                                            moduleJson = JSON.parse("" + data);
                                        }
                                        catch (e)
                                        {
                                            console.log("Failed to parse module: " + moduleJsonFilePath + ", data: " + data + ", err: " + e);
                                            return done();
                                        }

                                        // skip out if it isn't really a module file (needs name at least)
                                        if (!moduleJson.name)
                                        {
                                            return done();
                                        }

                                        stores.modules.fileStats(moduleJsonFilePath, function(err, stats) {

                                            if (err) {
                                                return done();
                                            }

                                            if (!stats) {
                                                console.log("Cannot find stats for module file: " + moduleJsonFilePath);
                                                return done();
                                            }

                                            var moduleDirectoryPath = path.dirname(moduleJsonFilePath);
                                            var moduleVersion = null;
                                            if (moduleJson.version)
                                            {
                                                moduleVersion = moduleJson.version;
                                            }

                                            var moduleDescriptor = {
                                                "path": moduleDirectoryPath,
                                                "store": "modules",
                                                "id": moduleJson.name,
                                                "mtimeMs": stats.mtimeMs
                                            };

                                            if (moduleVersion)
                                            {
                                                moduleDescriptor.version = moduleVersion;
                                            }

                                            moduleDescriptors.push(moduleDescriptor);

                                            done();
                                        });
                                    });
                                };
                            }(moduleJsonFilePaths[i]);
                            fns.push(fn);
                        }
                        async.series(fns, function() {

                            // add in any web store included modules that are provided as part of the configuration
                            //   process.configuration.modules.includes = []
                            // these paths are relative to the public directory of the web store
                            if (process.configuration.modules && process.configuration.modules.includes)
                            {
                                var moduleJsonFilePaths = process.configuration.modules.includes;

                                for (var i = 0; i < moduleJsonFilePaths.length; i++)
                                {
                                    var includePath = moduleJsonFilePaths[i];

                                    if (stores.web.publicDir)
                                    {
                                        var moduleDirectoryPath = path.join(stores.web.publicDir, includePath);
                                        var moduleId = moduleDirectoryPath.split("/");
                                        moduleId = moduleId[moduleId.length - 1];

                                        var include = process.includeWebModule(host, moduleId);
                                        if (include)
                                        {
                                            // NOTE: we don't add version information here
                                            // default is to assume same version as app
                                            moduleDescriptors.push({
                                                "path": moduleDirectoryPath,
                                                "store": "web",
                                                "id": moduleId
                                            });

                                            //console.log("Adding web:module.json for path: " + moduleDirectoryPath);
                                        }
                                    }
                                }
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
                        var moduleStoreType = moduleDescriptors[i].store;
                        var modulePath = moduleDescriptors[i].path;

                        //console.log("Config Store - Module Path: " + modulePath + ", type: " + moduleStoreType);

                        var storePath = path.join(modulePath, "config");
                        if (moduleStoreType === "modules")
                        {
                            storePath = path.join("modules", storePath);
                        }

                        //console.log("Config Store - Module Store: " + storePath);

                        var configStore = buildStore(moduleStoreType, host, storePath);
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
                        var moduleStoreType = moduleDescriptors[i].store;
                        var modulePath = moduleDescriptors[i].path;

                        var storePath = path.join(modulePath, "templates");
                        if (moduleStoreType === "modules")
                        {
                            storePath = path.join("modules", storePath);
                        }

                        var templateStore = buildStore(moduleStoreType, host, storePath);
                        templateStores.push(templateStore);
                    }

                    // trim back and only keep stores that are allocated
                    retainAllocatedStores(templateStores, function(err, allocatedStores) {

                        // all stores to be bound in
                        var bindingStores = [];
                        for (var i = 0; i < allocatedStores.length; i++) {
                            bindingStores.push(allocatedStores[i]);
                            //console.log("a2: " + allocatedStores[i]);
                        }
                        bindingStores.push(stores.templates);

                        // bind into a multi-store
                        stores["templates"] = require("./multistore")(bindingStores);

                        callback();
                    });
                };

                process.cache.read("module-descriptors-" + host, function(err, moduleDescriptors) {

                    moduleDescriptors = null;
                    if (!moduleDescriptors)
                    {
                        findModuleDescriptors(function(moduleDescriptors) {

                            // cache the module descriptors for 60 seconds
                            process.cache.write("module-descriptors-" + host, moduleDescriptors, 60);

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
                });
            };

            var bindContentStore = function(done)
            {
                stores["content"] = buildStore("content", host, "content");
                done();
            };

            var fns = [];
            fns.push(bindWebStore);
            fns.push(bindModuleStores);
            fns.push(bindContentStore);

            async.series(fns, function() {

                process.cache.read("module-descriptors-" + host, function(err, moduleDescriptorsForHost) {

                    if (!moduleDescriptorsForHost) {
                        moduleDescriptorsForHost = [];
                    }

                    _cached_stores(host, stores);

                    callback(null, stores, moduleDescriptorsForHost);

                });
            });
        });
    };

    r.invalidate = function(host)
    {
        // remove cached descriptors
        process.cache.remove("module-descriptors-" + host);

        // remove cached stores
        _cached_stores(host, null);
    };


    /**
     * @return {Function}
     */
    r.storesInterceptor = function()
    {
        return function(req, res, next)
        {
            produce(req.virtualHost, function(err, stores, moduleDescriptors) {

                req.stores = stores;

                req.rootStore = stores["root"];
                req.configStore = stores["config"];
                req.contentStore = stores["content"];
                req.webStore = stores["web"];
                req.templatesStore = stores["templates"];
                req.modulesStore = stores["modules"];

                // sort the module descriptors by id
                // this ensures they're always in an ascending order (a,b,c,d)
                if (moduleDescriptors)
                {
                    moduleDescriptors.sort(function(a, b) {
                        if (a.id > b.id) {
                            return -1;
                        }
                        if (b.id < a.id) {
                            return 1;
                        }
                        return 0;
                    });
                }

                // collect the module ids [<id>]
                // construct a huge cache key
                var moduleIdArray = [];
                var moduleKeys = [];
                if (moduleDescriptors)
                {
                    for (var i = 0; i < moduleDescriptors.length; i++)
                    {
                        if (moduleDescriptors[i].store === "modules")
                        {
                            var moduleId = moduleDescriptors[i].id;
                            var mtimeMs = moduleDescriptors[i].mtimeMs || -1;

                            moduleIdArray.push(moduleId);
                            moduleKeys.push(moduleId + ":" + mtimeMs);
                        }
                    }
                }

                // if we're rendering out the index.html top-most page, then we write down a cookie
                // if index.html is cached, it may not come through here, so we try to latch on to manifest.appcache as well
                // we also hook into the /context call
                if (req.path === "/" || req.path === "/index" || req.path === "/index.html")
                {
                    // compute a hash for the installed modules based on keys
                    var hugeKey = "modules";
                    if (moduleKeys && moduleKeys.length > 0)
                    {
                        hugeKey += "-" + moduleKeys.join("-");
                    }
                    var stateKey = hash(hugeKey, {
                        "algorithm": "md5"
                    });

                    // console.log("Writing State Key: " + stateKey + ", Path: " + req.path);

                    util.setCookie(req, res, "cloudcmsModuleStateKey", stateKey, {
                        "httpOnly": false
                    });

                    // always set cookie for module identifiers
                    util.setCookie(req, res, "cloudcmsModuleIdentifiers", "" + moduleIdArray.join(","), {
                        "httpOnly": false
                    });
                }

                next();
            });
        };
    };

    return r;
}();
