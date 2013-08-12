var http = require("http");
var path = require("path");

var AbstractTag = require("../abstracttag");

/**
 * The "cms:skip" tag.
 *
 * This tag doesn't render any output.  It informs its parent (assumed to be a paginated interface) of the skip
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
        var skipField = el.text();
        if (skipField)
        {
            this.setValue(parseInt(skipField));
        }
        else
        {
            this.setValue(0);
        }

        // set onto parent (if available)
        if (parent)
        {
            parent.setSkip(this);
        }

        return null;
    };
};

var exports = module.exports = function(tagRegistry)
{
    tagRegistry["cms:skip"] = function(context, parent, el) {

        var x = factory;
        x.prototype = new AbstractTag(context, parent, el);

        return new x(context, parent, el);

    };
};
