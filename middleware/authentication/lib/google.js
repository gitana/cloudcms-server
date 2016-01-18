var path = require('path');
var fs = require('fs');
var http = require('http');

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

/**
 * Handles Google authentication.
 *
 * Configuration
 *
 *    "google": {
 *       "enabled": true,
 *       "successRedirect": "/",
 *       "failureRedirect": "/",
 *       "clientID": "[OAuth2 Client ID]",
 *       "clientSecret": "[OAuth2 Client Secret]",
 *       "callbackURL": "/auth/google/callback"
 *    }
 * }
 *
 * @return {Function}
 */
exports = module.exports = function(passport, config)
{
    var PROVIDER_ID = "google";
    var PROVIDER_TITLE = "google";

    var r = {};

    var adapter = require("../adapter")(PROVIDER_ID, r, config);

    passport.use(new GoogleStrategy({
            clientID: config.clientID,
            clientSecret: config.clientSecret,
            callbackURL: config.callbackURL,
            passReqToCallback: true
        },
        adapter.verifyCallback
    ));

    r.providerId = function()
    {
        return PROVIDER_ID;
    };

    r.providerTitle = function()
    {
        return PROVIDER_TITLE;
    };

    r.handleLogin = function(req, res, next)
    {
        passport.authenticate(PROVIDER_ID,{
            scope:
                [
                    // 'openid',
                    // 'profile',
                    // 'email',
                    'https://www.googleapis.com/auth/plus.login',
                    'https://www.googleapis.com/auth/plus.me',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/userinfo.profile'
                    // 'https://www.googleapis.com/auth/cloud.useraccounts.readonly',
                    // 'https://www.googleapis.com/auth/plus.profile.emails.read'
                ]
        })(req, res, next);
    };

    r.handleCallback = function(req, res, next, cb)
    {
        console.log("handleCallback " + JSON.stringify(req.query));
        passport.authenticate(PROVIDER_ID, {
            successRedirect: config.successRedirect,
            failureRedirect: config.failureRedirect//,
            //session: false
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
                user.firstName = profile._json.name.givenName;
            }

            if (!user.lastName)
            {
                user.lastName = profile._json.name.familyName;
            }

            if (!user.gender)
            {
                user.gender = profile._json.gender;
            }

            callback();
        });
    };

    r.handleSyncAvatar = function(req, profile, user, callback)
    {
        callback();
    };

    return r;
};
