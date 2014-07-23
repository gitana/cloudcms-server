var path = require('path');
var fs = require('fs');
var http = require('http');
var uuid = require("node-uuid");

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
    /**
     * Loads the facebook user with this facebook profile.
     *
     * @param req
     * @param accessToken
     * @param refreshToken
     * @param profile
     * @param callback
     */
    var loadUser = function(req, accessToken, refreshToken, profile, callback)
    {
        var domain = req.gitana.datastore("principals");

        var fbId = profile.id;
        var query = {
            "facebookProfile.id1": fbId
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
     * @param accessToken
     * @param refreshToken
     * @param profile
     * @param callback
     */
    var autoRegister = function(req, accessToken, refreshToken, profile, callback)
    {
        var domain = req.gitana.datastore("principals");

        if (req.session.user)
        {
            Chain(domain).readPrincipal(req.session.user._doc).then(function() {
                this.facebookProfile = profile._json;
                this.update().then(function() {
                    callback(null, this);
                })
            });

            return;
        }

        var username = uuid.v4();
        var obj = {
            "type": "USER",
            "name": username,
            "facebookProfile": profile._json
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

    var verifyCallback = function(req, accessToken, refreshToken, profile, done)
    {
        // loads the existing user for this profile (if it exists)
        loadUser(req, accessToken, refreshToken, profile, function(err, user) {

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
                autoRegister(req, accessToken, refreshToken, profile, function(err, user) {
                    done(err, user);
                });
                return;
            }

            // nothing found
            done();
        });
    };

    passport.use(new FacebookStrategy({
            clientID: config.appId,
            clientSecret: config.appSecret,
            callbackURL: config.callbackUrl,
            passReqToCallback: true
        },
        verifyCallback
    ));

    var r = {};

    r.handleLogin = function(req, res, next)
    {
        // Redirect the user to Facebook for authentication.  When complete,
        // Facebook will redirect the user back to the application at
        //     /auth/facebook/callback
        passport.authenticate("facebook")(req, res, next);
    };

    r.handleCallback = function(req, res, next, cb)
    {
        passport.authenticate("facebook", {
            successRedirect: config.successRedirect,
            failureRedirect: config.failureRedirect//,
            //session: false
        }, cb)(req, res, next);
    };

    return r;
};

