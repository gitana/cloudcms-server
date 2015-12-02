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
    var PROVIDER_TITLE = "Twitter";

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

    r.handleSyncProfile = function(req, token, tokenSecret, profile, userObject, callback)
    {
        adapter.syncProfile(profile, userObject, function() {

            // username
            if (!userObject.name)
            {
                userObject.name = profile._json.name;
            }

            // description
            if (!userObject.description)
            {
                userObject.description = profile._json.description;
            }

            callback();
        });
    };

    r.handleSyncAvatar = function(req, profile, user, callback)
    {
        // sync avatar photo
        if (profile && profile.photos && profile.photos.length > 0)
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
    };

    return r;
};

