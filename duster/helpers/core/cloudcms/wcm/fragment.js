/**
 * @fragment
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../../engine")(app, dust);

    /**
     * FRAGMENT
     *
     * Declares a cacheable fragment.
     *
     * Syntax:
     *
     *    {@fragment}
     *       ...inner body
     *    {/fragment}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.fragment = function(chunk, context, bodies, params)
    {
        return engine.handleFragment(chunk, context, bodies, params);
    };

    callback();
};
