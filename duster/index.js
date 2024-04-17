var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../util/util");

var dust = require("dustjs-linkedin");
require("dustjs-helpers");

// we always set dust cache to false
// this is because dust cache is file path dependent (could collide across tenants)s
dust.config.cache = false;

// instead we manage our own template cache
var TEMPLATE_CACHE = {};

if (process.env.CLOUDCMS_APPSERVER_MODE === "production") {
    dust.debugLevel = "INFO";
} else {
    dust.debugLevel = "DEBUG";
    dust.config.cache = false;
}

if (process.env.CLOUDCMS_APPSERVER_MODE !== "production") {
    dust.config.whitespace = true;
}

if (process.env.DUST_DEBUG_LEVEL) {
    dust.debugLevel = (process.env.DUST_DEBUG_LEVEL + "").toUpperCase();
}

/**
 * Override Dust's isThenable() function so that Gitana driver chainable objects aren't included.
 *
 * @param elem
 * @returns {*|boolean}
 */
dust.isThenable = function(elem) {
    return elem &&
        typeof elem === 'object' &&
        typeof elem.then === 'function' && !elem.objectType;
};

/**
 * Override Dust's onLoad() function so that templates are loaded from the store.
 * The cache key is also determined to include the appId.
 *
 * @param templatePath
 * @param options
 * @param callback
 */
var loadTemplate = dust.onLoad = function(templatePath, options, callback)
{
    //var log = options.log;

    // `templateName` is the name of the template requested by dust.render / dust.stream
    // or via a partial include, like {> "hello-world" /}
    // `options` can be set as part of a Context. They will be explored later
    // `callback` is a Node-like callback that takes (err, data)

    var store = options.store;

    store.existsFile(templatePath, function(exists) {

        if (!exists) {
            return callback({
                "message": "Dust cannot find file: " + templatePath
            });
        }

        store.readFile(templatePath, function(err, data) {

            if (err) {
                return callback(err);
            }

            callback(null, "" + data);
        });
    });
};

/**
 * Provides a convenience interface into the Dust subsystem that Cloud CMS uses to process in-page tags.
 */
var exports = module.exports;

exports.getDust = function()
{
    return dust;
};

var populateContext = function(req, context, model, templateFilePath)
{
    if (model)
    {
        for (var k in model)
        {
            context[k] = model[k];
        }
    }

    // assume no user information

    // if we have a req.user, add this in
    if (req.user)
    {
        context.user = req.user;
        context.userId = req.user.id;
        context.userName = req.user.name;
    }

    // populate request information
    var qs = {};
    if (req.query)
    {
        for (var name in req.query)
        {
            var value = req.query[name];
            if (value)
            {
                qs[name] = value;
            }
        }
    }
    if (!context.request) {
        context.request = {};
    }
    context.request.uri = req.originalUrl;
    context.request.path = req.path;
    context.request.qs = qs;

    context.gitana = req.gitana;
    context.templateFilePaths = [templateFilePath];
    context.req = req;
    context.messages = {};

    // populate any flash messages
    if (req.flash)
    {
        var info = req.flash("info");
        if (info)
        {
            context.messages.info = info;
        }
    }

    if (req.helpers)
    {
        context.helpers = req.helpers;
    }

    // push base tracker instance for tracking dependencies
    // TODO: add user information?
    context["__tracker"] = {
        "requires": {},
        "produces": {}
    };

    // TODO: add user information?
    // this isn't clear... not all pages in a user authenticated web site will require per-user page caching...
    // if we were to do it, we'd do it manually like this
    //context["__tracker"]["requires"]["userId"] = [req.userId];

    // used to generate fragment IDs
    context["fragmentIdGenerator"] = function(url) {
        var counter = 0;
        return function() {
            return util.hashSignature("fragment-" + url + "-" + (++counter));
        };
    }(req.url);
};

exports.invalidateCacheForApp = function(applicationId)
{
    console.log("Invalidating dust cache for application: " + applicationId);

    var prefix = applicationId + ":";

    var badKeys = [];
    for (var k in TEMPLATE_CACHE)
    {
        if (k.indexOf(prefix) === 0) {
            badKeys.push(k);
        }
    }
    for (var i = 0; i < badKeys.length; i++)
    {
        console.log("Removing dust cache key: " + badKeys[i]);
        delete TEMPLATE_CACHE[badKeys[i]];
    }
};

exports.execute = function(req, store, filePath, model, callback)
{
    if (typeof(model) === "function")
    {
        callback = model;
        model = {};
    }

    ensureInit(store);

    var templatePath = filePath.split(path.sep).join("/");

    // build context
    var contextObject = {};
    populateContext(req, contextObject, model, templatePath);
    var context = dust.context(contextObject, {
        "req": req,
        "store": store,
        "log": dust.log,
        "dust": dust
    });

    // hold on to this instance so that we can get at it once we're done
    var tracker = context.get("__tracker");

    var executeTemplate = function(template, templatePath, context, callback)
    {
        // execute template
        var t1 = Date.now();
        dust.render(template, context, function(err, out) {
            var t2 = Date.now();

            if (err)
            {
                req.log("An error was caught while rendering dust template: " + templatePath + ", error: " + JSON.stringify(err, null, "  "));
            }

            // clean up - help out the garbage collector
            context.req = null;
            context.gitana = null;
            context.user = null;

            var dependencies = {
                "requires": tracker.requires,
                "produces": tracker.produces
            };

            var stats = {
                "dustExecutionTime": (t2 - t1)
            };

            // callback with dependencies
            callback(err, out, dependencies, stats);
        });
    };

    // does the template exist in the cache?
    var templateCacheKey = store.id + "_" + templatePath;
    var template = TEMPLATE_CACHE[templateCacheKey];
    if (template)
    {
        //console.log("FOUND IN TEMPLATE CACHE: " + templatePath);
        return executeTemplate(template, templatePath, context, callback);
    }

    // load and compile template by hand
    // we do this by hand in case it has a bug in it - we don't want it crashing the entire node process
    loadTemplate(templatePath, {
        "store": store
    }, function(err, text) {

        if (err) {
            return callback(err);
        }

        // compile and store into dust.cache
        try {
            //console.log("WRITE TO TEMPLATE CACHE: " + templatePath);
            template = dust.loadSource(dust.compile(text));
            TEMPLATE_CACHE[templateCacheKey] = template;
        } catch (e) {
            delete TEMPLATE_CACHE[templateCacheKey];
            return callback(e);
        }

        // proceed
        executeTemplate(template, templatePath, context, callback);
    });
};

/**
 * Init function that runs on the first call to duster.execute().
 * This ensures that templates are being watched properly.
 */
var _init = false;
var ensureInit = function(store)
{
    if (_init)
    {
        return;
    }

    _init = true;

    if (process.env.CLOUDCMS_APPSERVER_MODE !== "production")
    {
        // watch everything in web store
        store.watchDirectory("/", function (f, curr, prev) {

            console.log("Template changes detected - invalidating dust cache");
            var badKeys = [];
            for (var k in TEMPLATE_CACHE)
            {
                if (k.indexOf(store.id) === 0)
                {
                    badKeys.push(k);
                }
            }
            for (var i = 0; i < badKeys.length; i++)
            {
                console.log("Invalidating watched key: " + badKeys[i]);
                delete TEMPLATE_CACHE[badKeys[i]];
            }

        });
    }
};