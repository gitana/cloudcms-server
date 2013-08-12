var http = require("http");
var path = require("path");

var AbstractTag = require("../abstracttag");

/**
 * The "cms:type" tag.
 *
 * This tag doesn't render any output.  It informs its parent (assumed to be a paginated interface) of the sort
 * configuration.
 *
 * @param context
 * @param parent
 * @param el
 *
 * @returns {{}}
 */
var factory = function(context, parent, el)
{
    this.doExecute = function()
    {
        var typeField = el.text();
        if (typeField)
        {
            this.setValue(typeField);
        }
        else
        {
            this.setValue(null);
        }

        // set onto parent (if available)
        if (parent)
        {
            parent.setType(this);
        }

        return null;
    };
};

var exports = module.exports = function(tagRegistry)
{
    tagRegistry["cms:type"] = function(context, parent, el) {

        var x = factory;
        x.prototype = new AbstractTag(context, parent, el);

        return new x(context, parent, el);

    };
};
