var http = require("http");
var path = require("path");

var AbstractTag = require("../abstracttag");

/**
 * The "cms:template" tag.
 *
 * @param context
 * @param el
 *
 * @returns {{}}
 */
var factory = function(context, parent, el)
{
    this.doExecute = function()
    {
        // take everything inside of this el and compile using Handlebars
        var compiledTemplate = null;

        this.setValue(compiledTemplate);

        // set onto parent (if available)
        if (parent)
        {
            parent.setTemplate(this);
        }

        return html;
    };
};

var exports = module.exports = function(tagRegistry)
{
    tagRegistry["cms:template"] = function(context, parent, el) {

        var x = factory;
        x.prototype = new AbstractTag(context, parent, el);

        return new x(context, parent, el);

    };
};
