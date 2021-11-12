var path = require('path');
var util = require("../../util/util");

exports = module.exports = function()
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Retrieves themes for the application.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return util.createHandler("themes", function(req, res, next, stores, cache, configuration) {

            var themeStore = stores.themes;

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_themes") === 0)
                {
                    var filePath = req.path.substring(8);

                    themeStore.sendFile(res, filePath, null, function(err) {
                        next(err);
                    });

                    handled = true;
                }
            }

            if (!handled)
            {
                next();
            }
        });
    };

    return r;
}();
