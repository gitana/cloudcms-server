/**
 * @iter
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
     * iterates over keys of an object. Something that Dust apparently is not capable of.
     *
     * Syntax:
     *
     *    {@iter obj=jsonObject}
     *       type: {$key}
     *       value: {$value}
     *       type: {$type}
     *    {/iter}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.iter = function(chunk, context, bodies, params) {

        // TODO: there is already an @iterate helper defined in this helper file
        // TODO: do we need another?
        // TODO: {@iterate over=obj}{$key}-{$value} of type {$type}{~n}{/iterate}

        var obj = context.resolve(params.obj);

        var params2 = {};
        params2.over = obj;

        return dust.helpers.iterate(chunk, context, bodies, params2);
    };

    callback();
};
