var path = require('path');
var fs = require('fs');
var http = require('http');
var uuid = require("node-uuid");

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
    /**
     * Loads the facebook user with this facebook profile.
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

        var query = {
            "linkedinProfile.id1": profile.id
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
        var domain = req.gitana.datastore("principals");

        if (req.session.user)
        {
            Chain(domain).readPrincipal(req.session.user._doc).then(function() {
                this.linkedinProfile = profile._json;
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
            "linkedinProfile": profile._json
        };

        if (profile._json.firstName)
        {
            obj.firstName = profile._json.firstName;
        }
        if (profile._json.lastName)
        {
            obj.lastName = profile._json.lastName;
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

    passport.use(new LinkedInStrategy({
            consumerKey: config.apiKey,
            consumerSecret: config.apiSecret,
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
        passport.authenticate("linkedin")(req, res, next);
    };

    r.handleCallback = function(req, res, next, cb)
    {
        passport.authenticate("linkedin", {
            successRedirect: config.successRedirect,
            failureRedirect: config.failureRedirect,
            session: false
        }, cb)(req, res, next);
    };

    return r;
};

