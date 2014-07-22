var path = require('path');
var fs = require('fs');
var http = require('http');
var uuid = require("node-uuid");

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
    /**
     * Loads the twitter user with this twitter profile.
     *
     * @param req
     * @param token
     * @param tokenSecret
     * @param profile
     * @param callback
     */
    var loadUser = function(req, token, tokenSecret, profile, callback)
    {
        var domain = req.gitana.datastore("principals");

        var twitterId = profile.id;
        var query = {
            "twitterProfile.id": twitterId
        };

        Chain(domain).queryPrincipals(query).then(function() {

            if (this.totalRows() > 0)
            {
                this.keepOne().then(function() {
                    callback(null, this);
                });
            }
            else
            {
                callback();
            }
        });
    };

    /**
     * Automatically registers / creates the user for this facebook profile.
     *
     * @param req
     * @param token
     * @param tokenSecret
     * @param profile
     * @param callback
     */
    var autoRegister = function(req, token, tokenSecret, profile, callback)
    {
        //console.log("AUTO REGISTER: " + JSON.stringify(profile, null, "  "));

        var domain = req.gitana.datastore("principals");

        var username = uuid.v4();
        var obj = {
            "type": "USER",
            "name": username,
            "twitterProfile": profile._json
        };

        if (profile._json.first_name)
        {
            obj.firstName = profile._json.first_name;
        }
        if (profile._json.last_name)
        {
            obj.lastName = profile._json.last_name;
        }

        Chain(domain).trap(function() {
            callback();
            return false;
        }).createPrincipal(obj).then(function() {
            callback(null, this);
        });
    };

    var verifyCallback = function(req, token, tokenSecret, profile, done)
    {
        // loads the existing user for this profile (if it exists)
        loadUser(req, token, tokenSecret, profile, function(err, user) {

            if (err)
            {
                done(err);
                return;
            }

            if (user)
            {
                done(null, user);
                return;
            }

            if (config.autoRegister)
            {
                autoRegister(req, token, tokenSecret, profile, function(err, user) {
                    done(err, user);
                });
                return;
            }

            // nothing found
            done();
        });
    };

    passport.use(new TwitterStrategy({
            consumerKey: config.consumerKey,
            consumerSecret: config.consumerSecret,
            callbackURL: config.callbackUrl,
            passReqToCallback: true
        },
        verifyCallback
    ));

    var r = {};

    r.handleLogin = function(req, res, next)
    {
        passport.authenticate("twitter")(req, res, next);
    };

    r.handleCallback = function(req, res, next)
    {
        passport.authenticate("twitter", {
            failureRedirect: config.failureRedirect,
            session: false
        })(req, res, next);
    };

    return r;
};

