var path = require('path');
var util = require("../../util/util");
var request = require("request");

exports = module.exports = function()
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Retrieves browser-side AMD modules for an application.
     *
     * The URL structure is:
     *
     *    /_modules/<loaderId>/<path>
     *
     * In projects, this described as:
     *
     *    module://<loaderId>/<path>
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return util.createHandler("modules", function(req, res, next, configuration, stores) {

            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_modules") === 0)
                {
                    var filePath = req.path.substring(10);

                    var moduleLoaderId = null;
                    var modulePath = null;

                    var x = filePath.indexOf("/");
                    if (x > -1)
                    {
                        moduleLoaderId = filePath.substring(0, x);
                        modulePath = filePath.substring(x + 1);
                    }
                    else
                    {
                        moduleLoaderId = filePath;
                    }

                    //
                    // REGISTRY OF BACK END SOURCES
                    //

                    // TODO
                    var moduleLoaderBase = null;
                    if (moduleLoaderId === "cnn")
                    {
                        moduleLoaderBase = "http://www.cnn.com";
                    }

                    // if we didn't find a base, then 404 it
                    if (!moduleLoaderBase)
                    {
                        res.status(404).send("The module loader: " + moduleLoaderId + " is not defined");
                        return;
                    }

                    var url = moduleLoaderBase;
                    if (modulePath)
                    {
                        url += "/" + modulePath;
                    }

                    request
                        .get(url)
                        .on('response', function(response) {
                            console.log(response.statusCode) // 200
                            console.log(response.headers['content-type']) // 'image/png'
                        })
                        .pipe(res);

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
