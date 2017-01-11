/**
 * @form
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../engine")(app, dust);

    /**
     * EXPAND
     *
     * Query for a list of nodes by their id (._doc).
     * The list of id values can be supplied as an array of id values in
     * the 'list' arg or as an array of node records in the 'list' arg
     * along with a the name of a common key within each node that holds
     * the id.
     *
     * Syntax:
     *   ex. 1
	 *      {@expand list="components" key="editorialpage.components" as="components"}
     *          {+templateIdentifier/}
     *      {/expand}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.expand = function(chunk, context, bodies, params)
    {
        return engine.handleExpand(chunk, context, bodies, params);
    };

    callback();
};
