var path = require('path');
var fs = require('fs');
var http = require('http');

var dust = require("dustjs-linkedin");
require("dustjs-helpers");

if (process.env.NODE_ENV === "production") {
    dust.debugLevel = "INFO";
} else {
    dust.debugLevel = "DEBUG";
}

var tracker = require("./tracker");

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

    // TODO: populate user information
    context.user = {
        "name": "user@user.com",
        "firstName": "First Name",
        "lastName": "Last Name",
        "email": "user@email.com"
    };

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

    if (req.helpers)
    {
        context.helpers = req.helpers;
    }
};

exports.invalidateCacheForApp = function(applicationId)
{
    console.log("Invalidating dust cache for application: " + applicationId);

    var prefix = applicationId + ":";

    var badKeys = [];
    for (var k in dust.cache)
    {
        if (k.indexOf(prefix) === 0) {
            badKeys.push(k);
        }
    }
    for (var i = 0; i < badKeys.length; i++)
    {
        console.log("Removing dust cache key: " + badKeys[i]);
        delete dust.cache[badKeys[i]];
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

    store.existsFile(filePath, function(exists) {

        if (!exists) {
            callback({
                "message": "Dust cannot find file path: " + filePath
            });
            return;
        }

        var templatePath = filePath.split(path.sep).join("/");
        var templateKey = req.applicationId + ":" + templatePath;

        var processTemplate = function()
        {
            // build context
            var context = {};
            populateContext(req, context, model, filePath);

            // push base tracker instance for tracking dependencies
            var tracker = context["__tracker"] = {
                "requires": {},
                "produces": {}
            };

            // execute template
            dust.render(templateKey, context, function(err, out) {

                if (err)
                {
                    console.log("An error was caught while rendering dust template: " + templateKey + ", error: " + err);
                }

                var dependencies = {
                    "requires": tracker.requires,
                    "produces": tracker.produces
                };

                // callback with dependencies
                callback(err, out, dependencies);
            });
        };

        // load the contents of the file
        // make sure this is text
        if (!dust.cache[templateKey])
        {
            store.readFile(templatePath, function(err, data) {

                if (err) {
                    callback(err);
                    return;
                }

                var html = "" + data;

                try
                {
                    // compile
                    var compiledTemplate = dust.compile(html, templateKey);
                    dust.loadSource(compiledTemplate);

                    processTemplate();
                }
                catch (e)
                {
                    // compilation failed
                    console.log("Compilation failed for: " + filePath);
                    console.log(e);

                    callback({
                        "message": "Dust compilation failed for: " + filePath
                    });
                }
            });
        }
        else
        {
            processTemplate();
        }
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
            for (var k in dust.cache)
            {
                delete dust.cache[k];
            }

        });
    }
};
