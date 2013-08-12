var path = require('path');
var fs = require('fs');
var util = require("util");
var cheerio = require("cheerio");

var TagContext = require("./context");
var TagRegistry = require("./registry");

// tags
require("./cms/render");
require("./cms/sort");
require("./cms/limit");
require("./cms/skip");
require("./cms/template");

exports = module.exports = function(html)
{
    // parse the html into a dom
    var document = cheerio.load(html);

    /**
     * Finds any CMS tags in the document and executes them.
     * The resulting document is modified.
     *
     * @param context
     * @param el
     */
    var execute = function(context, el)
    {
        var tagName = el[0].name;

        if (tagName && tagName.indexOf("cms:") === 0)
        {
            // it's a cms tag
            executeTag(context, el, tagName);
        }
        else
        {
            // it's a standard HTML tag
            // dive down into children

            el.children().each(function() {
                execute(context, this);
            });

        }
    };

    /**
     * Processes a single CMS tag
     *
     * @param context
     * @param el
     * @param tagName
     */
    var executeTag = function(context, el, tagName)
    {
        var tag = TagRegistry.create(tagName, context, el);
        if (!tag)
        {
            console.log("Missing tag execution implementation: " + tagName);
            return;
        }

        tag.execute();
    };

    // response object
    var r = {};

    r.process = function()
    {
        // new context
        var context = new TagContext();

        execute(context, document("body"));

        return document.html();
    };

    return r;
};

