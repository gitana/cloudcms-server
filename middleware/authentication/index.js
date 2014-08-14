var path = require('path');
var fs = require('fs');
var http = require('http');

var passport = require('passport');

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

/**
 * Authentication middleware.
 *
 * @type {*}
 */
exports = module.exports = function(basePath)
{
    var LIBS = {};

    var addLibrary = function(configuration, providerId)
    {
        if (configuration.auth[providerId] && configuration.auth[providerId].enabled)
        {
            LIBS[providerId] = require("./lib/" + providerId)(passport, configuration.auth[providerId]);
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

        // return the middleware function
        return function(req, res, next)
        {
            if (!req.gitana || !req.gitana.application)
            {
                next();
                return;
            }

            var handled = false;

            // CONFIGURATION
            var configuration = {
                "auth": {}
            };
            if (process.configuration.auth) {
                for (var providerId in process.configuration.auth)
                {
                    configuration.auth[providerId] = process.configuration.auth[providerId];
                }
            }
            var app = req.gitana.application();
            if (app && app.runtime && app.runtime.auth) {
                for (var providerId in app.runtime.auth)
                {
                    configuration.auth[providerId] = app.runtime.auth[providerId];
                }
            }

            // LIBRARIES
            //addLibrary(configuration, "facebook");
            //addLibrary(configuration, "twitter");
            //addLibrary(configuration, "linkedin");

            // add in any libraries
            for (var providerId in configuration.auth)
            {
                addLibrary(configuration, providerId);
            }

            // HANDLE
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

                            var config = configuration.auth[providerId];

                            var cb = function(providerId, config)
                            {
                                return function(err, user, info)
                                {
                                    if (err)
                                    {
                                        return next(err);
                                    }

                                    if (!user)
                                    {
                                        return res.redirect(config.failureRedirect);
                                    }

                                    req.session.user = user;

                                    req.logIn(user, function(err) {

                                        if (err)
                                        {
                                            return next(err);
                                        }

                                        if (config.passTicket || config.passTokens)
                                        {
                                            var domain = req.gitana.datastore("principals");

                                            // connect and get ticket
                                            var x = {
                                                "clientKey": req.gitanaConfig.clientKey,
                                                "clientSecret": req.gitanaConfig.clientSecret,
                                                "username": domain.getId() + "/" + info.token,
                                                "password": info.tokenSecret,
                                                "baseURL": req.gitanaConfig.baseURL
                                            };
                                            Gitana.connect(x, function(err) {

                                                if (err)
                                                {
                                                    return res.redirect(config.failureRedirect);
                                                }

                                                var ticket = this.getDriver().getAuthInfo().getTicket();
                                                var token = info.token;
                                                var secret = info.tokenSecret;

                                                var params = [];
                                                params.push("providerId=" + providerId);
                                                if (config.passTicket) {
                                                    params.push("ticket=" + this.getDriver().getAuthInfo().getTicket());
                                                }
                                                if (config.passTokens) {
                                                    params.push("token=" + info.token);
                                                    params.push("secret=" + info.tokenSecret);
                                                }

                                                var url = config.successRedirect + "?" + params.join("&");

                                                return res.redirect(url);

                                            });
                                        }
                                        else
                                        {
                                            return res.redirect(config.successRedirect);
                                        }
                                    });

                                }
                            }(providerId, config);

                            lib.handleCallback(req, res, next, cb);
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

