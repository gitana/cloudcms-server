var path = require('path');
var fs = require('fs');
var http = require('http');
var request = require('request');
var util = require("../../util/util");

/**
 * Welcome middleware.
 *
 * Adjusts the URL to point to a welcome page when the "/" URL comes along.
 *
 * @type {Function}
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
     * Welcome interceptor
     *
     * Appends a welcome file by default to URLs that end with "/"
     *
     * @returns {Function}
     */
    r.welcomeInterceptor = function(configuration)
    {
        var isWelcomeEnabled = function()
        {
            return (typeof(configuration.welcome) != "undefined");
        };

        var getWelcome = function()
        {
            return configuration.welcome;
        };

        return function(req, res, next)
        {
            if (!isWelcomeEnabled())
            {
                next();
                return;
            }

            var url = req.originalUrl;

            var y = url.lastIndexOf("/");
            if (y == url.length - 1)
            {
                var newUrl = path.join(req.originalUrl, getWelcome());

                req.url = newUrl;
            }

            next();
        };
    };                            r

    return r;
};

