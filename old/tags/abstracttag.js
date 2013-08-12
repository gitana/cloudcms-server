var http = require("http");
var path = require("path");

var factory = function(context, parent, el)
{
    var body = null;
    var value = null;

    /**
     * Executes the tag.
     *
     * @param state
     * @param object
     *
     * @returns {*}
     */
    this.execute = function()
    {
        // is this tag referencing another tag?
        var ref = el.attr("ref");
        if (ref)
        {
            // this tag is a placeholder for another tag
            var referencedTag = context.getTag(ref);

            if (referencedTag.getBody())
            {
                el.replaceWith(referencedTag.getBody());
            }
        }

        // is this tag in display mode?
        var display = el.attr("display");
        if (typeof(display) === "undefined")
        {
            display = true;
        }
        else
        {
            display = (display === "true");
        }

        var replacementEl = this.doExecute(this);
        if (replacementEl && display)
        {
            this.setBody(replacementEl);
        }

        if (this.getBody())
        {
            el.replaceWith(this.getBody());
        }
    };

    /**
     * Executes the child tags of this tag.
     */
    this.executeChildren = function()
    {
        el.children().each(function() {

            // TODO

        });
    };

    /**
     * @abstract
     */
    this.doExecute = function()
    {
        return null;
    };

    this.setValue = function(_value)
    {
        value = value;
    };

    this.getValue = function()
    {
        return value;
    };

    this.setBody = function(b)
    {
        body = b;
    };

    this.getBody = function()
    {
        return body;
    };
};

var exports = module.exports = factory;