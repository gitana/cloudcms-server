var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require('../../util/util');

var Gitana = require("gitana");

var passport = require('passport');

/**
 * Authentication middleware.
 *
 * @type {*}
 */
exports = module.exports = function()
{
    var LIBS = {};

    var addLibrary = function(providerConfiguration, providerId)
    {
        if (providerConfiguration.providers[providerId] && providerConfiguration.providers[providerId].enabled)
        {
            LIBS[providerId] = require("./lib/" + providerId)(passport, providerConfiguration.providers[providerId]);
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.authenticationInterceptor = function(app)
    {
        return util.createInterceptor("authentication", "auth", function(req, res, next, stores, cache, configuration) {
            next();
        });
    };

    /**
     * Handler for authentication.
     *
     * @return {Function}
     */
    r.handler = function(app)
    {
        return util.createHandler("authentication", "auth", function(req, res, next, stores, cache, configuration) {

            var handled = false;

            if (!configuration.providers)
            {
                configuration.providers = {};
            }

            if (!configuration.providers.cas) {
               configuration.providers.cas = {};
            }
            if (process.env.CLOUDCMS_AUTH_PROVIDERS_CAS_ENABLED === "true") {
               configuration.providers.cas.enabled = true;
            }

            if (!configuration.providers.github) {
               configuration.providers.github = {};
            }
            if (process.env.CLOUDCMS_AUTH_PROVIDERS_GITHUB_ENABLED === "true") {
               configuration.providers.github.enabled = true;
            }

            if (!configuration.providers.google) {
               configuration.providers.google = {};
            }
            if (process.env.CLOUDCMS_AUTH_PROVIDERS_GOOGLE_ENABLED === "true") {
               configuration.providers.google.enabled = true;
            }

            if (!configuration.providers.facebook) {
               configuration.providers.facebook = {};
            }
            if (process.env.CLOUDCMS_AUTH_PROVIDERS_FACEBOOK_ENABLED === "true") {
               configuration.providers.facebook.enabled = true;
            }

            if (!configuration.providers.twitter) {
               configuration.providers.twitter = {};
            }
            if (process.env.CLOUDCMS_AUTH_PROVIDERS_TWITTER_ENABLED === "true") {
               configuration.providers.twitter.enabled = true;
            }

            if (!configuration.providers.linkedin) {
               configuration.providers.linkedin = {};
            }
            if (process.env.CLOUDCMS_AUTH_PROVIDERS_LINKEDIN_ENABLED === "true") {
               configuration.providers.linkedin.enabled = true;
            }
            if (process.env.CLOUDCMS_AUTH_PASS_TICKET === "true") {
               configuration.passTicket = true;
               configuration.providers.github.passTicket = true;
               configuration.providers.google.passTicket = true;
               configuration.providers.facebook.passTicket = true;
               configuration.providers.twitter.passTicket = true;
               configuration.providers.linkedin.passTicket = true;
            }

            // add in any libraries
            for (var providerId in configuration.providers)
            {
                addLibrary(configuration, providerId);
            }

            // HANDLE
            if (req.method.toLowerCase() === "get")
            {
                var i = req.path.indexOf("/auth/");
                if (i > -1)
                {
                    var providerId = req.path.substring(i + 6);

                    var j = providerId.indexOf("/");
                    if (j > -1)
                    {
                        providerId = providerId.substring(0, j);
                    }

                    var lib = LIBS[providerId];
                    if (lib)
                    {
                        if (req.path.indexOf("/callback") > -1)
                        {
                            handled = true;

                            var config = configuration.providers[providerId];

                            var cb = function (providerId, config) {
                                return function (err, user, info) {

                                    // store provider information onto session
                                    req.session.lastProviderInfo = info;

                                    if (err) {
                                        console.log(err);
                                        return res.redirect(config.failureRedirect);
                                    }

                                    if (!user) {

                                        // we signed into the provider but a logged in user wasn't found
                                        // if a registration page redirect is provided, we'll go there
                                        // otherwise, we just go to the error page
                                        var redirectUrl = config.registrationRedirect;
                                        if (!redirectUrl) {
                                            redirectUrl = config.failureRedirect;
                                        }

                                        // redirect
                                        return res.redirect(redirectUrl);
                                    }

                                    req.session.user = user;

                                    req.logIn(user, function (err) {

                                        if (err) {
                                            return res.redirect(config.failureRedirect);
                                        }

                                        if (config.passTicket || config.passTokens) {

                                            var domain = req.gitana.datastore("principals");

                                            // connect and get ticket
                                            var x = {
                                                "clientKey": req.gitanaConfig.clientKey,
                                                "clientSecret": req.gitanaConfig.clientSecret,
                                                "username": domain.getId() + "/" + info.token,
                                                "password": info.tokenSecret,
                                                "baseURL": req.gitanaConfig.baseURL
                                            };
                                            Gitana.connect(x, function (err) {

                                                if (err) {
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
                                        else {
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
        });
    };

    r.getProvider = function(providerId)
    {
        return LIBS[providerId];
    };

    return r;

}();
