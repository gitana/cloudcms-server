/**
 * @link
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
    var resolveVariables = engine.resolveVariables;

    /**
     * Produces an anchor link.
     *
     * Syntax:
     *
     *    {@link [uri="uri"] [other token values]}
     *      Click me to go to the next page!
     *    {/link}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.link = function(chunk, context, bodies, params)
    {
        var classParam = context.resolve(params.class);

        // push tokens into context
        var tokens = context.get("request").tokens;
        context = context.push(tokens);

        // push params into context
        var paramsObject = {};
        for (var name in params)
        {
            if (name !== "uri")
            {
                paramsObject[name] = context.resolve(params[name]);
            }
        }
        context = context.push(paramsObject);

        // use uri from params or fallback to request uri
        var uri = context.resolve(params.uri);
        if (!uri)
        {
            uri = context.get("request").matchingPath;
        }

        return map(chunk, function(chunk) {

            // ensure uri is resolved
            resolveVariables([uri], context, function(err, results) {

                var uri = results[0];

                chunk.write("<a href='" + uri + "'");

                if (classParam)
                {
                    chunk.write(" class='" + classParam + "'");
                }

                chunk.write(">");
                chunk.render(bodies.block, context);
                chunk.write("</a>");

                end(chunk, context);

            });

        });
    };

    callback();
};
