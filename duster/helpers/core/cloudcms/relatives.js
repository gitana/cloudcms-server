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
     * RELATIVES
     *
     * Finds relatives around a node.
     *
     * Syntax:
     *
     *    {@relatives node="<nodeId>" associationType="<association_type>" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/relatives}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.relatives = function(chunk, context, bodies, params)
    {
        return engine.handleRelatives(chunk, context, bodies, params);
    };

    callback();
};
