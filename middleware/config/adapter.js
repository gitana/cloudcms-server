var fs = require("fs");
var watch = require("watch");
var path = require("path");

var subscriberUtil = require("./util");

var loadConfigObject = function(path)
{
	if (!fs.existsSync(path)) {
		console.log("Unable to find config file: " + path);
		return;
	}
	
	var data = fs.readFileSync(path);
	
	var object = null;
	try 
	{
		object = JSON.parse(data);
	}
	catch (err) 
	{
	    console.log("There has been an error parsing JSON for file: " + path)
	    console.log(err);
	}	
	
	return object;
};

var loadPages = function(dirPath, pageKey, context)
{
    if (!fs.existsSync(dirPath)) {
        console.log("Unable to find directory: " + dirPath);
        return;
    }

    // collect all of the page configs under this path
    var configs = {};
    var filenames = fs.readdirSync(dirPath);
    for (var i = 0; i < filenames.length; i++)
    {
        var childPath = path.join(dirPath, filenames[i]);

        if (filenames[i].indexOf(".json") > -1)
        {
            var config = loadConfigObject(childPath);
            if (config) {
                configs[filenames[i]] = config;
            }
        }
        else
        {
            // if it is a directory, traverse down
            var stats = fs.statSync(childPath);
            if (stats && stats.isDirectory())
            {
                loadPages(childPath, path.join(pageKey, filenames[i]), context);
            }
        }
    }

    // if we found a "page.json" at this level...
    if (configs["page.json"])
    {
        // populate page into context
        // if it already exists, merge
        var d = context.pages[pageKey];
        if (!d)
        {
            d = {};
        }
        merge(configs["page.json"], d);
        context.pages[pageKey] = d;
        delete configs["page.json"];

        console.log(" -> Registered page: " + pageKey);

        // everything else in the directory is assumed to be a region binding
        for (var regionFileName in configs)
        {
            var region = regionFileName.substring(0, regionFileName.indexOf(".json"));

            var gadget = configs[regionFileName];

            // generate a unique gadget key
            var gadgetKey = subscriberUtil.generateSubscriberKey(pageKey, region, 0);
            gadget["key"] = gadgetKey;

            if (!context.pages[pageKey].bindings) {
                context.pages[pageKey].bindings = {};
            }
            context.pages[pageKey].bindings[region] = gadget;
            context.gadgets[gadgetKey] = gadget;

            console.log("     -> Registered gadget: " + gadgetKey + " (" + region + ")");
        }
    }
};

var loadBlocks = function(dirPath, context)
{
    if (!fs.existsSync(dirPath)) {
        console.log("Unable to find directory: " + dirPath);
        return;
    }

    // collect all of the page configs under this path
    var configs = {};
    var filenames = fs.readdirSync(dirPath);
    for (var i = 0; i < filenames.length; i++)
    {
        var childPath = path.join(dirPath, filenames[i]);

        if (filenames[i].indexOf(".json") > -1)
        {
            var config = loadConfigObject(childPath);
            if (config) {
                configs[childPath] = config;
            }
        }
        else
        {
            // if it is a directory, traverse down
            var stats = fs.statSync(childPath);
            if (stats && stats.isDirectory())
            {
                loadBlocks(childPath, context);
            }
        }
    }

    // merge in any configs we found at this level
    for (var k in configs)
    {
        context.blocks[k] = configs[k];
    }
};

/**
 * Loads page and gadget binding information.
 *
 * @return {Object}
 */
exports.init = function(configDirectoryPath, callback)
{
    if (!configDirectoryPath) {
        configDirectoryPath = "./config";
    }

    // watch and load from directoryPath...
    //    /config/application.js
    //    /config/<module>/pages/**.json
    //    /config/<module>/blocks/**.json
    //      -> within each directory, load (region).json for gadget definitions

	var loadContext = function()
	{
        console.log("Loading context from: " + configDirectoryPath);

		var context = {};

        var app = loadConfigObject(path.join(configDirectoryPath, "application.json"));
        if (app)
        {
            context.application = app;
        }

        context.pages = {};
        context.gadgets = {};
        context.blocks = {};

        // find all modules
        var filenames = fs.readdirSync(configDirectoryPath);
        for (var i = 0; i < filenames.length; i++)
        {
            var moduleDirectoryPath = path.join(configDirectoryPath, filenames[i]);

            var stats = fs.statSync(moduleDirectoryPath);
            if (stats && stats.isDirectory())
            {
                loadPages(path.join(moduleDirectoryPath, "pages"), "", context);
                loadBlocks(path.join(moduleDirectoryPath, "blocks"), context);
            }
        }

		return context;
	};
	
	var context = loadContext();

	// parse all views
	var store = wrapAsStore(context);
	callback.call(this, store);

	// watch all changes anywhere in directoryPath
	// when changes occur, reload context
	(function(store) {

        var first = true;

		watch.watchTree(configDirectoryPath, function(f, curr, prev) {

            if (!first) {

                var t1 = new Date().getTime();

                // reload context
                var newContext = loadContext();
                wrapAsStore(newContext);
                store.reloadContext(newContext);

                var t2 = new Date().getTime();

                console.log("Reloaded context in: " + (t2-t1) + " ms");

            }

            first = false;

		});

	})(store);

};

var merge = function(source, target)
{
	for (var k in source)
	{
		if (source[k].push)
		{
			if (!target[k])
			{
				target[k] = [];
			}
			
			// merge array
			for (var x = 0; x < source[k].length; x++)
			{
				target[k].push(source[k][x]);
			}
		}
		else if ((typeof source[k]) == "object")
		{
			if (!target[k])
			{
				target[k] = {};
			}
			
			// merge keys/values
			merge(source[k], target[k]);
		}
		else
		{
			// overwrite a scalar
			target[k] = source[k];				
		}
	}
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
        var ext = pageObj["extends"];
        if (typeof(ext) == "string")
        {
            var parentObj = compilePage(context, ext);
            // strip uris
            delete parentObj.uri;
            merge(parentObj, obj);
        }
        else
        {
            for (var z = 0; z < ext.length; z++)
            {
                var parentObj = compilePage(context, ext[z]);
                delete parentObj.uri;
                merge(parentObj, obj);
            }
        }
	}
	
	// copy ourselves in
	merge(pageObj, obj);

    // remove special stuff from the resulting obj
    delete obj["extends"];

    return obj;
};

var wrapAsStore = function(context)
{
	console.log("Configuration Store");
		
	// compile the pages
	//console.log(" -> Compiling pages");
	context.compiledPages = {};
	for (var pageKey in context.pages)
	{
        var page = context.pages[pageKey];
        if (page.uri) {
		    context.compiledPages[pageKey] = compilePage(context, pageKey);
        }
	}
	//console.log(" -> Page compilation completed");
	
	// store page count
	context.pageCount = 0;
	for (var pageKey in context.pages)
	{
		context.pageCount++;
	}
	console.log(" -> Page count: " + context.pageCount);

    // compiled page count
    context.compiledPageCount = 0;
    for (var pageKey in context.compiledPages)
    {
        context.compiledPageCount++;
    }
    console.log(" -> Compiled page count: " + context.compiledPageCount);

    // gadget bindings count
	context.gadgetCount = 0;
	for (var gadgetKey in context.gadgets)
	{
		context.gadgetCount++;
	}
	console.log(" -> Gadget count: " + context.gadgetCount);

    // blocks count
    context.blockCount = 0;
    for (var blockKey in context.blocks)
    {
        context.blockCount++;
    }
    console.log(" -> Block count: " + context.blockCount);



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
        //console.log("Compiled page is -> " + JSON.stringify(config.compiledPage));

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

    return {

        /**
         * Loads a compiled page configuration for a given uri.
         *
         * @param uriOrKey
         * @param callback
         */
        loadPage: function(uriOrKey, callback)
        {
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
			
        },


        /**
         * Loads all compiled page configurations
         *
         * @param callback
         */
        loadPages: function(callback)
        {
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
        },

        loadBlocks: function(callback)
        {
            var self = this;

            callback.call(self, context.blocks);
        },

        loadGadget: function(pageKey, region, order)
        {
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
        },

		loadApplication: function(callback)
		{
			callback.call(this, context.application);
		},
		
		reloadContext: function(newContext)
		{
			for (var key in newContext)
			{
				context[key] = newContext[key];
			}
		}
    };
};
