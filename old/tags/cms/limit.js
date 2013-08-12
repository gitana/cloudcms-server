var http = require("http");
var path = require("path");

var AbstractTag = require("../abstracttag");
var TagRegistry = require("../registry");

/**
 * The "cms:limit" tag.
 *
 * This tag doesn't render any output.  It informs its parent (assumed to be a paginated interface) of the limit
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
        var limitField = el.text();
        if (limitField)
        {
            this.setValue(parseInt(limitField));
        }
        else
        {
            this.setValue(-1);
        }

        // set onto parent (if available)
        if (parent)
        {
            parent.setLimit(this);
        }


        return null;
    };

};

var exports = module.exports = function(tagRegistry)
{
    tagRegistry["cms:limit"] = function(context, parent, el) {

        var x = factory;
        x.prototype = new AbstractTag(context, parent, el);

        return new x(context, parent, el);

    };
};
