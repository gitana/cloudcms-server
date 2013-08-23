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

var populateContext = function(context, model)
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
};

exports.execute = function(filePath, model, callback)
{
    if (typeof(model) === "function")
    {
        callback = model;
        model = {};
    }

    // load the contents of the file
    // make sure this is text
    var compiled = false;
    if (!dust.cache[filePath])
    {
        var html = "" + fs.readFileSync(filePath);

        try
        {
            // compile
            var compiledTemplate = dust.compile(html, filePath);
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
        populateContext(context, model);

        // execute template
        dust.render(filePath, context, function(err, out) {
            callback(null, out);
        });
    }
    else
    {
        callback({
            "mesage": "Unable to compile template for file path: " + filePath
        });
    }
};
