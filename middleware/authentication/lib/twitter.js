var path = require('path');
var fs = require('fs');
var http = require('http');

var TwitterStrategy = require('passport-twitter').Strategy;

/**
 * Handles twitter authentication.
 *
 * Configuration
 *
 *    "twitter": {
 *       "enabled": true,
 *       "successRedirect": "/",
 *       "failureRedirect": "/",
 *       "callbackUrl": "/auth/twitter/callback",
 *       "consumerKey": "",
 *       "consumerSecret": ""
 *    }
 * }
 *
 * @return {Function}
 */
exports = module.exports = function(passport, config)
{
    var PROVIDER_ID = "twitter";

    var r = {};

    var adapter = require("../adapter")(PROVIDER_ID, r, config);

    passport.use(new TwitterStrategy({
            consumerKey: config.consumerKey,
            consumerSecret: config.consumerSecret,
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

            // description
            if (!user.description)
            {
                user.description = profile._json.description;
            }

            // sync avatar photo
            if (profile.photos && profile.photos.length > 0)
            {
                // use the 0th one as the avatar
                var photoUrl = profile.photos[0].value;

                // download and attach to user
                adapter.downloadAndAttach(req, photoUrl, user, "avatar", function(err) {
                    callback();
                });
            }
            else
            {
                callback();
            }
        });
    };

    return r;
};

