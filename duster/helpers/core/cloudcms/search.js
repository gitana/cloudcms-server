/**
 * @search
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
     * Runs a search and passes the rows to a rendering template.
     *
     * Syntax:
     *
     *    {@search sort="title" scope="page" text="something" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/search}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.search = function(chunk, context, bodies, params)
    {
        return engine.handleSearch(chunk, context, bodies, params, false);
    };

    callback();
};
