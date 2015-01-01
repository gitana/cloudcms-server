var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require('../../util/util');

/**
 * Authorization middleware.
 *
 * Provides interceptors to check whether a given URI requires authentication prior to proceeding.
 *
 * @type {*}
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
     * Checks whether the currently accessed resource requires authentication.
     *
     * If so, the request is redirected to a login page.
     *
     * @return {Function}
     */
    r.authorizationInterceptor = function()
    {
        return util.createInterceptor("authorization", function(req, res, next, configuration) {

            var pathRequiresAuthorization = false;

            /*
             // TODO: determine which paths require authorization
             if (req.path.indexOf("/author") > -1) {
             pathRequiresAuthorization = true;
             }
             */

            if (pathRequiresAuthorization) {
                if (req.session && req.session.requestContext) {
                    next();
                }
                else {
                    res.redirect("/login");
                }
            }
            else {
                next();
            }
        });
    };

    return r;

}();

