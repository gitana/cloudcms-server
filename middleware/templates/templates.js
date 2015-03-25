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
     * Retrieves templates for the application.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return util.createHandler("templates", function(req, res, next, configuration, stores) {

            var templateStore = stores.templates;

            var handled = false;

            if (req.method.toLowerCase() == "get") {

                if (req.url.indexOf("/_templates") === 0)
                {
                    var filePath = req.path.substring(11);

                    templateStore.sendFile(res, filePath, null, function(err) {
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
