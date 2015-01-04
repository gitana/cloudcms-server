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

    var produce = r.produce = function(host, callback)
    {
        var stores = {};
        stores["root"] = buildStore("root", host);

        // assume a few things...
        stores["config"] = buildStore("config", host, "config");
        stores["content"] = buildStore("content", host, "content");

        var bindWebStore = function(done) {

            var webStore = stores["web"] = buildStore("web", host);

            webStore.existsDirectory("public", function(exists) {

                if (exists)
                {
                    stores["web"] = buildStore("web", host, "public");
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

        var bindConfigStore = function(done)
        {
            /*
            rootStore.existsFile("config", function(exists) {

                if (exists) {
                    stores["config"] = rootStore.mount("config");
                }

                done();

            });
            */

            stores["config"] = buildStore("config", host, "config");
            done();
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
        fns.push(bindConfigStore);
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
