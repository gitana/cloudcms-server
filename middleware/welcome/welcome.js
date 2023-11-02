var path = require('path');
var util = require("../../util/util");

/**
 * Welcome middleware.
 *
 * Adjusts the URL to point to a welcome page when the "/" URL comes along.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Welcome interceptor
     *
     * Appends a welcome file by default to URLs that end with "/"
     *
     * @returns {Function}
     */
    r.welcomeInterceptor = function()
    {
        return util.createInterceptor("welcome", function(req, res, next, stores, cache, configuration) {

            if (configuration.file)
            {
                var url = req.originalUrl;

                var y = url.lastIndexOf("/");
                if (y === url.length - 1)
                {
                    req.url = path.join(req.originalUrl, configuration.file);
                    req.path = path.join(req.path, configuration.file);
                }

                next();
            }
            else
            {
                next();
            }
        });
    };

    return r;
}();

