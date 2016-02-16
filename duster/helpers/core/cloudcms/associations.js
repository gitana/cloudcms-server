/**
 * @associations
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../engine")(app, dust);

    /**
     * ASSOCIATIONS
     *
     * Finds associations around a node.
     *
     * Syntax:
     *
     *    {@associations node="<nodeId>" type="<association_type>" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/associations}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.associations = function(chunk, context, bodies, params)
    {
        return engine.handleAssociations(chunk, context, bodies, params);
    };

    callback();
};
