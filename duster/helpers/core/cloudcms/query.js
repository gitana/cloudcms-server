/**
 * @query
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../engine")(app, dust);

    /**
     * QUERY
     *
     * Queries for content from the content repository and renders.
     *
     * Syntax:
     *
     *    {@query sort="title" scope="page" type="custom:type" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/query}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.query = function(chunk, context, bodies, params)
    {
        return engine.handleQuery(chunk, context, bodies, params, false);
    };

    callback();
};
