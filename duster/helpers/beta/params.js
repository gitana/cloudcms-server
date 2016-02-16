/**
 * @params
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    /**
     * Allows parameters to be passed into blocks or partials
     */
    dust.helpers.params = function( chunk, context, bodies, params ){

        var partial = {};
        if( params)
        {
            for (var key in params)
            {
                partial[key] = params[key];
            }
        }

        // render
        var newContext = context.push(partial);

        //return bodies.block(chunk, dust.makeBase(partial))
        return bodies.block(chunk, newContext);
    };
    dust.helpers.parameters = dust.helpers.params;

    callback();
};
