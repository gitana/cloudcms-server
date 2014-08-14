var path = require('path');
var fs = require('fs');
var http = require('http');

var FacebookStrategy = require('passport-facebook').Strategy;

/**
 * Handles facebook authentication.
 *
 * Configuration
 *
 *    "facebook": {
 *       "enabled": true,
 *       "successRedirect": "/",
 *       "failureRedirect": "/",
 *       "callbackUrl": "/auth/facebook/callback",
 *       "appId": "",
 *       "appSecret": ""
 *    }
 * }
 *
 * @return {Function}
 */
exports = module.exports = function(passport, config)
{
    var PROVIDER_ID = "facebook";

    var r = {};

    var adapter = require("../adapter")(PROVIDER_ID, r, config);

    passport.use(new FacebookStrategy({
            clientID: config.appId,
            clientSecret: config.appSecret,
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
            failureRedirect: config.failureRedirect//,
            //session: false
        }, cb)(req, res, next);
    };

    r.providerUserId = function(profile)
    {
        console.log("PROFILE: " + JSON.stringify(profile, null, "  "));
        return profile.id;
    };

    r.handleSyncProfile = function(req, token, tokenSecret, profile, user, callback)
    {
        console.log("HANDLE SYNC PROFILE: " + PROVIDER_ID);

        adapter.syncProfile(profile, user, function() {
            callback();
        });
    };

    return r;
};

