var auth = require("../../../util/auth");

var passport = require("passport");
var CasStrategy = require('passport-cas').Strategy;

/**
 * "cas" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "ssoBaseURL": "http://www.example.com/",
 *    "serverBaseURL": "http://localhost:3000",
 *    "validateURL": <for cas 2.0>
 *
 * @return {Function}
 */
exports = module.exports = function(PROVIDER_ID, PROVIDER_TYPE, config)
{
    var r = require("./abstract")(PROVIDER_ID, PROVIDER_TYPE, config);

    // passport
    var casStrategy = new CasStrategy({
        "ssoBaseURL": config.ssoBaseURL,
        "serverBaseURL": config.serverBaseURL,
        "validateURL": config.validateURL,
        "passReqToCallback": true
    }, auth.buildPassportCallback(PROVIDER_TYPE, r));
    passport.use(casStrategy);

    /**
     * @override
     */
    r.profileIdentifier = function(profile)
    {
        return profile.username;
    };

    /**
     * @override
     */
    r.handleAuth = function(req, res, next)
    {
        passport.authenticate(PROVIDER_TYPE)(req, res, next);
    };

    /**
     * @override
     */
    r.handleAuthCallback = function(req, res, next, cb)
    {
        passport.authenticate(PROVIDER_TYPE, {
            successRedirect: config.successRedirect,
            failureRedirect: config.failureRedirect
        }, cb)(req, res, next);
    };

    /**
     * @override
     */
    r.parseProfile = function(profile)
    {
        var userObject = {};

        if (!userObject.firstName)
        {
            userObject.firstName = profile.given_name;
        }

        if (!userObject.lastName)
        {
            userObject.lastName = profile.family_name;
        }

        if (!userObject.email)
        {
            userObject.email = profile.email;
        }

        return userObject;
    };

    r.syncAvatar = function(gitanaUser, profile, callback)
    {
        callback();
    };

    /**
     * @override
     */
    r.load = function(token, callback)
    {
        casStrategy.userProfile(token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile, token, null);
        });
    };

    return r;
};

