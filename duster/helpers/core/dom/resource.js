/**
 * @resource
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
     * Constructs a resource uri that is cache aware.
     *
     * Syntax:
     *
     *    {@resource uri="/images/logo.svg"/}
     *    {@res uri="/images/logo.svg"/}
     *    {@r uri="/images/logo.svg"/}
     *
     * Example:
     *
     *    <img src="{@resource uri="/images/logo.svg"/}">
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.r = dust.helpers.res = dust.helpers.resource = function(chunk, context, bodies, params)
    {
        params = params || {};

        var uri = context.resolve(params.uri);

        return map(chunk, function(chunk) {

            if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
            {
                var req = context.get("req");
                if (req)
                {
                    var newUri = uri;

                    var cacheBuster = req.runtime.cb;

                    var i = uri.lastIndexOf(".");
                    if (i == -1)
                    {
                        newUri = uri + "." + cacheBuster;
                    }
                    else
                    {
                        newUri = uri.substring(0, i) + "-" + cacheBuster + uri.substring(i);
                    }

                    chunk.write(newUri);
                    end(chunk, context);
                }
                else
                {
                    chunk.write(uri);
                    end(chunk, context);
                }
            }
            else
            {
                chunk.write(uri);
                end(chunk, context);
            }
        });
    };

    callback();
};
