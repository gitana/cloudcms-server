var tracker = require("../../../../tracker");

/**
 * @dependency
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var support = require("../../../../support")(dust);
    var map = support.map;
    var end = support.end;
    
    /**
     * Flags a dependency for a page.
     *
     * There are two types of dependencies - "produces" and "requires".
     *
     * "Produces" means that the HTML output of the page contains data from one or more dependencies.  These dependencies
     * are identified by IDs and are usually Node IDs.  If the page shows an attachment from a Node, it should be flagged
     * as having a "produces" dependency with that Node's ID.  If it shows article text in any way, the article's Node
     * ID should be marked as a "produces" dependency.
     *
     * "Requires" means that the cached HTML can only be served if the requirement is met.  The "requires" dependencies
     * may only consist of request-time state that is known *before* the Dust processor begins to run.  That way, the
     * Dust processor can elect to use the cache state instead of executing the page.  The "requires" dependencies
     * are usually request information (url, parameters, locale) or user information (user's name, id) but may also
     * consist of information that is acquired by Express middleware that runs ahead of WCM (which usually runs toward
     * the end).
     *
     * If "type" is not specified, it is assumed to be "produces".
     *
     * Syntax:
     *
     *    {@dependency type="produces" key="{key}" value="{value}"}
     *       {+templateIdentifier/}
     *    {/dependency}
     *
     *    {@dependency type="requires" key="{key}" value="{value}"}
     *       {+templateIdentifier/}
     *    {/dependency}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.dependency = function(chunk, context, bodies, params)
    {
        var type = context.resolve(params.type);
        var key = context.resolve(params.key);
        var value = context.resolve(params.value);

        return map(chunk, function(chunk) {

            // TRACKER: START
            tracker.start(context);

            if (!type || type === "produces" || type === "produce" || type === "p") {

                // TRACKER - PRODUCES "key" = "value"
                tracker.produces(context, key, value);

            }
            else if (type === "requires" || type === "require" || type === "r") {

                // TRACKER - REQUIRES "key" = "value"
                tracker.requires(context, key, value);

            }
            else {
                console.log("Unknown type for @dependency tag: " + type);
            }

            // keep going
            end(chunk, context);
        });
    };

    callback();
};
