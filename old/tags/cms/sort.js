var http = require("http");
var path = require("path");

var AbstractTag = require("../abstracttag");

/**
 * The "cms:sort" tag.
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
        var sortField = el.text();
        if (sortField)
        {
            this.setValue(sortField);
        }
        else
        {
            this.setValue(null);
        }

        // set onto parent (if available)
        if (parent)
        {
            parent.setSort(this);
        }

        return null;
    };
};

var exports = module.exports = function(tagRegistry)
{
    tagRegistry["cms:sort"] = function(context, parent, el) {

        var x = factory;
        x.prototype = new AbstractTag(context, parent, el);

        return new x(context, parent, el);

    };
};
