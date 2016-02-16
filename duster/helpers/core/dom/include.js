/**
 * @include
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
     * INCLUDE
     *
     * Includes another dust template into this one and passes any context forward.
     *
     * Syntax:
     *
     *    {@include path="../template.html" ...args/}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.include = function(chunk, context, bodies, params)
    {
        params = params || {};

        var targetPath = context.resolve(params.path);

        return engine.handleInclude(chunk, context, bodies, params, targetPath);
    };

    callback();
};
