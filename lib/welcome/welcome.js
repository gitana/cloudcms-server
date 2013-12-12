var path = require('path');
var fs = require('fs');
var http = require('http');
var request = require('request');

var util = require("../util/util");

var Gitana = require("gitana");

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);

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

                //console.log("Changing: " + req.originalUrl + " -> " + newUrl);
                req.url = newUrl;
            }

            next();
        };
    };                            r

    return r;
};

