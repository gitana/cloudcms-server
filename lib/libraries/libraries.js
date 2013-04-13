var path = require('path');
var fs = require('fs');
var http = require('http');

exports = module.exports = function(basePath)
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Supports retrieval of any _lib libraries.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return function(req, res, next)
        {
            var uri = req.path;

            if (uri.indexOf("/_lib/") == 0)
            {
                uri = uri.substring(5);

                res.sendfile(uri, {
                    "root": path.join(__dirname, "../../web")
                }, function(err) {

                    // some kind of IO issue streaming back
                    res.send(503, err);
                    res.end();

                });
            }
            else
            {
                next();
            }
        };
    };

    return r;
};





