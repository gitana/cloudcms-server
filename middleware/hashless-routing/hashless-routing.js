var path = require('path');
var util = require("../../util");

/**
 * Support for hashless URL routing.
 *
 * @type {Function}
 */
exports = module.exports = function(basePath)
{
    var storage = require("../../util/storage")(basePath);

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var isHashlessRoutingEnabled = function(configuration)
    {
        var enabled = false;

        if (configuration && configuration.hashlessRouting)
        {
            if (typeof(configuration.hashlessRouting.enabled) != "undefined")
            {
                enabled = configuration.hashlessRouting.enabled;
            }
        }

        return enabled;
    };

    var r = {};

    /**
     * Handles hashless routing.

     * @return {Function}
     */
    r.hashlessRoutingHandler = function(configuration)
    {
        return function(req, res, next)
        {
            if (isHashlessRoutingEnabled(configuration))
            {
                var publicPath = util.publicPath(req, storage);

                res.sendfile(path.join(publicPath, "index.html"));
            }
            else
            {
                next();
            }
        };
    };

    return r;
};





