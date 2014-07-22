var path = require('path');
var fs = require('fs');
var http = require('http');

var passport = require('passport');

/**
 * Authentication middleware.
 *
 * @type {*}
 */
exports = module.exports = function(basePath)
{
    var LIBS = {};

    var addLibrary = function(providerId)
    {
        if (process.configuration && process.configuration.auth[providerId] && process.configuration.auth[providerId].enabled)
        {
            LIBS[providerId] = require("./lib/" + providerId)(passport, process.configuration.auth[providerId]);
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Handler for authentication.
     *
     * @return {Function}
     */
    r.handler = function(app)
    {
        app.use(passport.initialize());
        app.use(passport.session());

        // require any libraries
        addLibrary("facebook");
        addLibrary("twitter");
        addLibrary("linkedin");

        // return the middleware function
        return function(req, res, next)
        {
            var handled = false;

            if (req.method.toLowerCase() == "get")
            {
                var i = req.url.indexOf("/auth/");
                if (i > -1)
                {
                    var providerId = req.url.substring(i + 6);

                    var j = providerId.indexOf("/");
                    if (j > -1)
                    {
                        providerId = providerId.substring(0, j);
                    }

                    var lib = LIBS[providerId];
                    if (lib)
                    {
                        if (req.url.indexOf("/callback"))
                        {
                            handled = true;

                            lib.handleCallback(req, res, next);
                        }
                        else
                        {
                            handled = true;

                            lib.handleLogin(req, res, next);
                        }
                    }
                }
            }

            if (!handled)
            {
                next();
            }
        }
    };

    return r;

};

