var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("util");

var mkdirp = require('mkdirp');

var Gitana = require('gitana');

var localeUtil = require("../util/locale");

var dust = require("dustjs-linkedin");
require('dustjs-helpers');
require("./dusthelpers")(dust);

var exports = module.exports;

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

    context.gitana = req.gitana;
    context.templateFilePath = templateFilePath;
    context.req = req;

    if (req.helpers)
    {
        context.helpers = req.helpers;
    }
};

exports.invalidateCacheForApp = function(applicationId)
{
    var badKeys = [];
    for (var k in dust.cache)
    {
        if (k.indexOf(applicationId + "_") === 0)
        {
            badKeys.push(k);
        }
    }
    for (var i = 0; i < badKeys.length; i++)
    {
        console.log("Removing bad key from dust cache: " + badKeys[i]);
        delete dust.cache[badKeys[i]];
    }
};

exports.execute = function(req, filePath, model, callback)
{
    if (typeof(model) === "function")
    {
        callback = model;
        model = {};
    }

    ensureInit();

    if (!fs.existsSync(filePath))
    {
        callback({
            "message": "Cannot find WCM file path: " + filePath
        });
        return;
    }

    var templatePath = req.applicationId + "_" + filePath.split(path.sep).join("/");

    // load the contents of the file
    // make sure this is text
    var compiled = false;
    if (!dust.cache[templatePath])
    {
        var html = "" + fs.readFileSync(filePath);

        try
        {
            // compile
            var compiledTemplate = dust.compile(html, templatePath);
            dust.loadSource(compiledTemplate);

            compiled = true;
        }
        catch (e)
        {
            // compilation failed
            console.log("Compilation failed for: " + filePath);
            console.log(e);
        }
    }
    else
    {
        compiled = true;
    }

    // render compiled file
    if (compiled)
    {
        // build context
        var context = {};
        populateContext(req, context, model, filePath);

        // execute template
        dust.render(templatePath, context, function(err, out) {

            if (err)
            {
                console.log("An error was caught while rendering dust template: " + filePath + ", error: " + err);
            }

            callback(err, out);
        });
    }
    else
    {
        callback({
            "mesage": "Unable to compile template for file path: " + filePath
        });
    }
};


/**
 * Init function that runs on the first call to duster.execute().
 * This ensures that templates are being watched properly.
 */
var initted = false;
var ensureInit = function()
{
    if (initted)
    {
        return;
    }

    initted = true;

    if (process.env.CLOUDCMS_APPSERVER_MODE == "development")
    {
        var watch = require("watch");
        if (process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH)
        {
            console.log("Watching directory: " + process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH);

            var watchPath = path.join(process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH);
            watch.watchTree(watchPath, {
                "ignoreDotFiles": true
            }, function (f, curr, prev) {

                console.log("Template changes detected - invalidating dust cache");
                for (var k in dust.cache)
                {
                    delete dust.cache[k];
                }

            });
        }
    }
};
