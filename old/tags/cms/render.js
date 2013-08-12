var http = require("http");
var path = require("path");

var AbstractTag = require("../abstracttag");
var TagRegistry = require("../registry");

/**
 * The "cms:render" tag.
 *
 * @param context
 * @param parent the parent tag
 * @param el
 *
 * @returns {{}}
 */
var factory = function(context, parent, el)
{
    var templateTag = null;
    var sourceTag = null;

    this.doExecute = function()
    {
        // allow any children to process
        this.executeChildren();

        var template = templateTag.getValue();
        var results = sourceTag.getValue();

        // build the model
        var model = {};
        model.results = results;

        // execute template
        var html = template(model);

        return html;
    };

    this.setTemplate = function(templateTag)
    {

    };

    this.setSource = function(sourceTag)
    {

    }
};

var exports = module.exports = function(tagRegistry)
{
    tagRegistry["cms:render"] = function(context, parent, el) {

        var x = factory;
        x.prototype = new AbstractTag(context, parent, el);

        return new x(context, parent, el);

    };
};
