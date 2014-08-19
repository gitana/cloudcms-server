var path = require('path');
var fs = require('fs');
var http = require('http');

var LinkedInStrategy = require('passport-linkedin').Strategy;

/**
 * Handles linkedin authentication.
 *
 * Configuration
 *
 *    "linkedin": {
 *       "enabled": true,
 *       "successRedirect": "/",
 *       "failureRedirect": "/",
 *       "callbackUrl": "/auth/linkedin/callback",
 *       "appId": "",
 *       "appSecret": ""
 *    }
 * }
 *
 * @return {Function}
 */
exports = module.exports = function(passport, config)
{
    var PROVIDER_ID = "linkedin";

    var r = {};

    var adapter = require("../adapter")(PROVIDER_ID, r, config);

    passport.use(new LinkedInStrategy({
            consumerKey: config.apiKey,
            consumerSecret: config.apiSecret,
            callbackURL: config.callbackUrl,
            passReqToCallback: true
        },
        adapter.verifyCallback
    ));

    r.handleLogin = function(req, res, next)
    {
        passport.authenticate(PROVIDER_ID)(req, res, next);
    };

    r.handleCallback = function(req, res, next, cb)
    {
        passport.authenticate(PROVIDER_ID, {
            successRedirect: config.successRedirect,
            failureRedirect: config.failureRedirect,
            session: false
        }, cb)(req, res, next);
    };

    r.providerUserId = function(profile)
    {
        return profile.id;
    };

    r.handleSyncProfile = function(req, token, tokenSecret, profile, user, callback)
    {
        adapter.syncProfile(profile, user, function() {

            if (!user.firstName)
            {
                user.firstName = profile._json.firstName;
            }

            if (!user.lastName)
            {
                user.lastName = profile._json.lastName;
            }

            callback();
        });
    };

    r.handleSyncAvatar = function(req, token, tokenSecret, profile, user, callback)
    {
        callback();
    };

    return r;
};

