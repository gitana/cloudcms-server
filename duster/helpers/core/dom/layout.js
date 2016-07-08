var path = require("path");

/**
 * @layout
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
     * INCLUDE LAYOUT
     *
     * Includes a layout dust template into this one and passes any context forward.
     *
     * Syntax:
     *
     *    {@layout path="path" ...args/}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.layout = function(chunk, context, bodies, params)
    {
        params = params || {};

        var targetPath = context.resolve(params.path);

        if (targetPath.indexOf("/layouts") === 0)
        {
            // we're ok
        }
        else
        {
            targetPath = path.join("/layouts", targetPath);
        }

        return engine.handleInclude(chunk, context, bodies, params, targetPath);
    };

    callback();
};
