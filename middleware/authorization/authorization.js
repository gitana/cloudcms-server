var path = require('path');
var fs = require('fs');
var http = require('http');

/**
 * Authorization middleware.
 *
 * Provides interceptors to check whether a given URI requires authentication prior to proceeding.
 *
 * @type {*}
 */
exports = module.exports = function(basePath)
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Checks whether the currently accessed resource requires authentication.  If so, the request is redirected
     * to a login page.
     *
     * @return {Function}
     */
    r.authenticatedInterceptor = function()
    {
        return function(req, res, next)
        {
            var pathRequiresAuthorization = false;

            // TODO: determine which paths require authorization
            if (req.path.indexOf("/author") > -1) {
                pathRequiresAuthorization = true;
            }

            if (pathRequiresAuthorization)
            {
                if(req.session && req.session.requestContext)
                {
                    next();
                }
                else
                {
                    res.redirect("/login");
                }
            }
            else
            {
                next();
            }
        };
    };

    return r;

};

