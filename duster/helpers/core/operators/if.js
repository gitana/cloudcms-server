/**
 * @if
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
     * It seems ridiculous to me that we should have to add this back in.  But it was deprecated in newer versions of
     * dust.js.  Logic is sound but frankly, I expect most of our users will want to use @if.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     * @returns {*}
     */
    dust.helpers.if = function( chunk, context, bodies, params ){

        var body = bodies.block;
        var skip = bodies['else'];

        if( params && params.cond)
        {
            var cond = params.cond;
            cond = context.resolve(cond);

            // eval expressions with given dust references
            if (eval(cond))
            {
                if (body)
                {
                    return chunk.render( bodies.block, context );
                }
                else
                {
                    console.log( "Missing body block in the if helper!" );
                    return chunk;
                }
            }

            if (skip)
            {
                return chunk.render( bodies['else'], context );
            }
        }
        // no condition
        else
        {
            console.log( "No condition given in the if helper!" );
        }

        return chunk;
    };

    callback();

};
