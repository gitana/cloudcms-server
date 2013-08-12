var http = require("http");
var path = require("path");

var AbstractTag = require("../abstracttag");

/**
 * The "cms:query" tag.
 *
 * @param context
 * @param parent the parent tag
 * @param el
 *
 * @returns {{}}
 */
var factory = function(context, parent, el)
{
    var skipTag = null;
    var limitTag = null;
    var sortTag = null;
    var typeTag = null;

    this.doExecute = function()
    {
        // allow any children to process
        this.executeChildren();

        // TODO: now do our thing
        // run the query and produce results
        var results = {};

        // store results
        this.setValue(results);

        // set onto parent (if available)
        if (parent)
        {
            parent.setSource(this);
        }

        return null;
    };

    this.setSkip = function(_skipTag)
    {
        skipTag = _skipTag;
    };

    this.setLimit = function(_limitTag)
    {
        limitTag = _limitTag;
    };

    this.setSort = function(_sortTag)
    {
        sortTag = _sortTag;
    };

    this.setType = function(_typeTag)
    {
        typeTag = _typeTag;
    };
};

var exports = module.exports = function(tagRegistry)
{
    tagRegistry["cms:query"] = function(context, parent, el) {

        var x = factory;
        x.prototype = new AbstractTag(context, parent, el);

        return new x(context, parent, el);

    };
};
