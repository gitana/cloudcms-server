var path = require("path");
var async = require("async");

var util = require("../../util/util");

// debug helper method to reduce logging
var _log = function(text)
{
    //console.log(text);
};

/**
 * Provides an adapter around a store.
 *
 * @param configStore
 */
module.exports = function(configStore)
{
    /**
     * Reduces a path like:
     *
     *    /a/b/c/d/../e/../../f
     *
     * to
     *
     *    /a/b/f
     *
     * @param p
     */
    var normalizePath = function(p)
    {
        return path.normalize(p);
    };

    var generateSubscriberKey = function() {

        var count = 0;

        return function(pageKey, region, order)
        {
            return "gadget" + (count++);
        }
    }();

    var loadConfigObject = function(path, callback)
    {
        configStore.existsFile(path, function(exists) {

            if (!exists)
            {
                return callback({
                    "message": "Unable to find config file: " + path
                });
            }

            configStore.readFile(path, function(err, data) {

                if (err)
                {
                    return callback(err);
                }

                try
                {
                    var object = JSON.parse(data);

                    callback(null, object);
                }
                catch (err)
                {
                    console.log("An error occurred while parsing JSON: " + data + " for file: " + path);
                    console.log(err);

                    callback(err);
                }
            });
        });
    };

    var loadPages = function(dirPath, pageKey, context, callback)
    {
        configStore.existsFile(dirPath, function(exists) {

            if (!exists)
            {
                return callback();
            }

            // collect all of the page configs under this path
            var configs = {};
            configStore.listFiles(dirPath, function(err, filenames) {

                var fns = [];
                for (var i = 0; i < filenames.length; i++)
                {
                    var fn = function(dirPath, filename, configs) {
                        return function(done) {
                            var childPath = path.join(dirPath, filename);

                            if (filename.indexOf(".json") > -1)
                            {
                                loadConfigObject(childPath, function(err, config) {

                                    if (config) {
                                        configs[filename] = config;
                                    }

                                    done();
                                });
                            }
                            else
                            {
                                configStore.fileStats(childPath, function(err, stats) {

                                    if (err)
                                    {
                                        done(err);
                                        return;
                                    }

                                    if (stats && stats.directory)
                                    {
                                        // iterate down
                                        loadPages(childPath, path.join(pageKey, filename), context, function(err) {
                                            done(err);
                                        });
                                    }
                                    else {
                                        done();
                                    }
                                });
                            }
                        }
                    }(dirPath, filenames[i], configs);
                    fns.push(fn);
                }

                async.series(fns, function(errors) {

                    // if we found a "page.json" at this level...
                    if (configs["page.json"])
                    {
                        // populate page into context
                        // if it already exists, merge
                        var d = context.pages[pageKey];
                        if (!d) {
                            d = {};
                        }
                        util.merge(configs["page.json"], d);
                        context.pages[pageKey] = d;
                        delete configs["page.json"];

                        _log(" -> Registered page: " + pageKey);

                        // everything else in the directory is assumed to be a region binding
                        for (var regionFileName in configs)
                        {
                            var region = regionFileName.substring(0, regionFileName.indexOf(".json"));

                            var gadget = configs[regionFileName];

                            // generate a unique gadget key
                            var gadgetKey = generateSubscriberKey(pageKey, region, 0);
                            gadget["key"] = gadgetKey;

                            if (!context.pages[pageKey].bindings) {
                                context.pages[pageKey].bindings = {};
                            }

                            context.pages[pageKey].bindings[region] = gadget;
                            context.gadgets[gadgetKey] = gadget;

                            _log("     -> Registered gadget: " + gadgetKey + " (" + region + ")");
                        }
                    }

                    callback();
                });
            });
        });
    };

    var loadBlocks = function(dirPath, context, callback)
    {
        configStore.existsFile(dirPath, function(exists) {

            if (!exists)
            {
                return callback({
                    "message": "Unable to find directory: " + dirPath
                });
            }

            // collect all of the page configs under this path
            var configs = {};

            configStore.listFiles(dirPath, function(err, filenames) {

                var fns = [];
                for (var i = 0; i < filenames.length; i++)
                {
                    var fn = function(dirPath, filename)
                    {
                        return function(done)
                        {
                            var childPath = path.join(dirPath, filename);

                            if (filename.indexOf(".json") > -1)
                            {
                                loadConfigObject(childPath, function(err, config) {
                                    if (config) {
                                        configs[childPath] = config;
                                    }

                                    done();
                                });
                            }
                            else
                            {
                                configStore.fileStats(childPath, function(err, stats) {

                                    if (stats && stats.directory) {
                                        loadBlocks(childPath, context, function(err) {
                                            done();
                                        });
                                    }
                                    else
                                    {
                                        // it is something else, something we do not care about (such as .DS_Store)
                                        done();
                                    }

                                });
                            }
                        }
                    }(dirPath, filenames[i]);
                    fns.push(fn);
                }

                async.series(fns, function(errors) {

                    // merge in any configs we found at this level
                    for (var k in configs) {
                        context.blocks[k] = configs[k];
                    }

                    callback();
                });

            });
        });
    };

    /**
     * Loads page and gadget binding information.
     *
     * @return {Object}
     */
    var x = {};
    x.init = function(callback)
    {
        // watch and load from directoryPath...
        //    /config/application.js
        //    /config/<module>/pages/**.json
        //    /config/<module>/blocks/**.json
        //      -> within each directory, load (region).json for gadget definitions

        var loadContext = function(callback)
        {
            var context = {};

            loadConfigObject("application.json", function(err, app) {

                if (app) {
                    context.application = app;
                }

                context.pages = {};
                context.gadgets = {};
                context.blocks = {};

                // find all modules
                configStore.listFiles("/", function (err, filenames) {

                    if (err) {
                        callback(err);
                        return;
                    }

                    var fns = [];
                    for (var i = 0; i < filenames.length; i++) {
                        var fn = function (filename, context) {
                            return function (done) {

                                // NOTE: filename = module name

                                configStore.fileStats(filename, function (err, stats) {
                                    if (stats.directory) {
                                        loadPages(path.join(filename, "pages"), "", context, function (err) {

                                            if (err) {
                                                done(err);
                                                return;
                                            }

                                            loadBlocks(path.join(filename, "blocks"), context, function (err) {
                                                done(err);
                                            });
                                        });

                                    }
                                    else {
                                        done();
                                    }
                                });
                            }
                        }(filenames[i], context);
                        fns.push(fn);
                    }

                    async.series(fns, function (errors) {
                        callback(null, context);
                    });
                });
            });
        };

        loadContext(function(err, context) {

            if (err)
            {
                return callback(err);
            }

            // wrap as registry
            var registry = compileContextToRegistry(context);

            // all done
            callback(null, registry);

            var _watchLog = function(text) {
                console.log("[Configuration Watch] " + text);
            };

            if (process.env.CLOUDCMS_APPSERVER_CONFIG_WATCH === "true" || process.env.CLOUDCMS_APPSERVER_CONFIG_WATCH === true)
            {
                _watchLog("Setting up live watch...");

                // set a watch
                // watch for changes and when they happen, reload context
                (function (registry) {

                    configStore.watchDirectory("/", function () {

                        _watchLog("Detected changes on disk - reloading...");

                        var t1 = new Date().getTime();

                        // reload context
                        loadContext(function (err, context) {

                            if (err) {
                                return _watchLog("Failed to load configuration context: " + err);
                            }

                            try
                            {
                                compileContextToRegistry(context);
                                registry.reloadContext(context);

                                var t2 = new Date().getTime();
                                _watchLog("Reloaded context in: " + (t2 - t1) + " ms");
                            }
                            catch (e)
                            {
                                _watchLog("Caught error while compiling and reloading context: " + err);
                            }
                        });
                    });

                })(registry);
            }

        });
    };

    var compilePage = function(context, pageKey)
    {
        var obj = {};

        var pageObj = context.pages[pageKey];
        if (!pageObj)
        {
            console.log("Missing page object for key: " + pageKey);
            return;
        }
        if (pageObj["extends"])
        {
            var ext = pageObj["extends"]; // ../_platform-manage

            var p1 = pageKey;
            var p2 = null;
            if (ext.indexOf("./") > -1)
            {
                // append so that we have a path like "/a/b/../../c/d" -> "/c/d"
                pageKey = pageKey + "/" + ext;

                // now normalize the path

                ext = normalizePath(pageKey);
                p2 = ext;
            }

            if (typeof(ext) === "string")
            {
                var parentObj = compilePage(context, ext);
                if (!parentObj)
                {
                    console.log("Page Key 1: " + p1);
                    console.log("Page Key 2: " + p2);

                    console.error("WARNING: Failed to find parent page: " + ext + " for pageKey: " + p1);
                }
                else
                {
                    // strip uris
                    delete parentObj.uri;
                    util.merge(parentObj, obj);
                }
            }
            else
            {
                for (var z = 0; z < ext.length; z++)
                {
                    var parentObj = compilePage(context, ext[z]);
                    if (!parentObj)
                    {
                        console.error("WARNING: Failed to find parent page: " + ext + " for pageKey: " + pageKey);
                    }
                    else
                    {
                        delete parentObj.uri;
                        util.merge(parentObj, obj);
                    }
                }
            }
        }

        // copy ourselves in
        util.merge(pageObj, obj);

        // remove special stuff from the resulting obj
        delete obj["extends"];

        return obj;
    };

    var compileContextToRegistry = function(context)
    {
        _log("Configuration Store");

        // compile the pages
        //_log(" -> Compiling pages");
        context.compiledPages = {};
        for (var pageKey in context.pages)
        {
            var page = context.pages[pageKey];
            if (page.uri) {
                context.compiledPages[pageKey] = compilePage(context, pageKey);
            }
        }
        //_log(" -> Page compilation completed");

        // store page count
        context.pageCount = 0;
        for (var pageKey in context.pages)
        {
            context.pageCount++;
        }
        //_log(" -> Page count: " + context.pageCount);

        // compiled page count
        context.compiledPageCount = 0;
        for (var pageKey in context.compiledPages)
        {
            context.compiledPageCount++;
        }
        //_log(" -> Compiled page count: " + context.compiledPageCount);

        // gadget bindings count
        context.gadgetCount = 0;
        for (var gadgetKey in context.gadgets)
        {
            context.gadgetCount++;
        }
        //_log(" -> Gadget count: " + context.gadgetCount);

        // blocks count
        context.blockCount = 0;
        for (var blockKey in context.blocks)
        {
            context.blockCount++;
        }
        //_log(" -> Block count: " + context.blockCount);



        ///////////////////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////


        var createPageConfig = function(pageKey, page, callback)
        {
            var self = this;

            var config = {};

            // application
            config.application = context.application;

            // page
            config.pageKey = pageKey;
            config.page = page;
            config.page.key = pageKey;

            // compiled page
            //config.compiledPage = context.compiledPages[pageKey];
            //_log("Compiled page is -> " + JSON.stringify(config.compiledPage));

            // template
            config.template = config.page.template;

            var doBind = function(config, regionName, gadget)
            {
                var gadgetCopy = JSON.parse(JSON.stringify(gadget));
                gadgetCopy.region = regionName;
                config.gadgets[gadget.key] = gadgetCopy;
            };

            // bindings and gadget configurations
            config.gadgets = {};
            if (config.page.bindings)
            {
                for (var regionName in config.page.bindings)
                {
                    var gadgetObjectOrArray = config.page.bindings[regionName];
                    if (gadgetObjectOrArray.push)
                    {
                        for (var i = 0; i < gadgetObjectOrArray.length; i++)
                        {
                            doBind(config, regionName, gadgetObjectOrArray[i]);
                        }
                    }
                    else
                    {
                        doBind(config, regionName, gadgetObjectOrArray);
                    }
                }
            }

            callback.call(self, config);
        };

        var registry = {};

        /**
         * Loads a compiled page configuration for a given uri.
         *
         * @param uriOrKey
         * @param callback
         */
        registry.loadPage = function(uriOrKey, callback) {
            var self = this;

            var found = null;
            var foundPageKey = null;

            for (var pageKey in context.compiledPages)
            {
                var page = context.compiledPages[pageKey];

                if (page.uri)
                {
                    // check for uri match
                    // page uris can have wildcards or {value} tokens in them
                    // we convert the page uri to a regex
                    var regex = page.uri;
                    var i = 0;
                    var j = -1;
                    var k = -1;
                    while (i < regex.length)
                    {
                        if (regex[i] == "{")
                        {
                            j = i;
                        }

                        if (regex[i] == "}")
                        {
                            k = i;
                            regex = regex.substring(0, j) + "(.*)" + regex.substring(k+1);
                            j = -1;
                            k = -1;
                            i = 0;
                        }

                        i++;
                    }
                    regex += "$";

                    var pattern = new RegExp(regex);
                    var matches = uriOrKey.match(pattern);
                    if (pageKey == uriOrKey || (matches && matches.length > 0))
                    {
                        found = page;
                        foundPageKey = pageKey;
                        break;
                    }
                }
            }

            // if no page, the error out?
            if (!found)
            {
                console.log("No page found for uriOrKey: " + uriOrKey);
            }

            createPageConfig.call(self, foundPageKey, found, function(config) {
                callback.call(self, config);
            });

        };

        /**
         * Loads all compiled page configurations
         *
         * @param callback
         */
        registry.loadPages =function(callback) {

            var self = this;

            var configs = {};

            // if no pages then just bail
            var pageCount = context.compiledPageCount;
            if (pageCount == 0)
            {
                callback.call(self, configs);
                return;
            }

            for (var pageKey in context.compiledPages)
            {
                createPageConfig.call(self, pageKey, context.compiledPages[pageKey], function(config) {
                    configs[pageKey] = config;
                    pageCount--;

                    if (pageCount == 0)
                    {
                        callback.call(self, configs);
                    }
                });
            }
        };

        registry.loadBlocks = function(callback) {
            var self = this;

            callback.call(self, context.blocks);
        };

        registry.loadGadget = function(pageKey, region, order, callback) {

            var binding = context.page.bindings[region];
            if (!binding)
            {
                console.log("Unable to find gadget, page: " + pageKey + ", region: " + region + ", order: " + order);
            }

            var gadget = null;
            if (binding.push)
            {
                gadget = binding[order];
            }
            else
            {
                gadget = binding;
            }

            callback.call(this, gadget);
        };

        registry.loadApplication = function(callback) {
            callback.call(this, context.application);
        };

        registry.reloadContext = function(newContext) {
            for (var key in newContext)
            {
                context[key] = newContext[key];
            }
        };

        registry.getConfigStore = function()
        {
            return configStore;
        };

        return registry;
    };

    return x;
};