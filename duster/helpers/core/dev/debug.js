/**
 * @debug
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../engine")(app, dust);
    var map = engine.map;
    var end = engine.end;

    /**
     * Shows debug information about the current context
     *
     * Syntax:
     *
     *    {@debug/}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.debug = function(chunk, context, bodies, params)
    {
        //params = params || {};

        return map(chunk, function(chunk) {

            var json = JSON.stringify(context.stack.head, null, "  ");
            var html = "<textarea>" + json + "</textarea>";
            chunk.write(html);

            end(chunk, context);
        });
    };


    callback();
};
