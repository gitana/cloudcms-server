/**
 * @searchOne
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../engine")(app, dust);

    /**
     * SEARCH
     *
     * Runs a search and keeps one of the result items.  Passes the result to the rendering template.
     *
     * Syntax:
     *
     *    {@searchOne sort="title" scope="page" text="something" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/searchOne}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.searchOne = function(chunk, context, bodies, params)
    {
        return engine.handleSearch(chunk, context, bodies, params, true);
    };

    callback();
};
