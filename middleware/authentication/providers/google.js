var auth = require("../../../util/auth");

var passport = require("passport");
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

if (!process.configuration.providers) {
    process.configuration.providers = {};
}
if (!process.configuration.providers.google) {
    process.configuration.providers.google = {};
}
if (process.env.CLOUDCMS_AUTH_PROVIDERS_GOOGLE_ENABLED === "true") {
    process.configuration.providers.google.enabled = true;
}

/**
 * "google" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "clientID": "[OAuth2 Client ID]",
 *    "clientSecret": "[OAuth2 Client Secret]",
 *
 * @return {Function}
 */
exports = module.exports = function(PROVIDER_ID, PROVIDER_TYPE, config)
{
    if (!config.properties) {
        config.properties = {};
    }
    if (!config.properties.id) {
        config.properties.id = "id";
    }

    var r = require("./abstract")(PROVIDER_ID, PROVIDER_TYPE, config);

    // passport
    var googleStrategy = new GoogleStrategy({
        clientID: config.clientID,
        clientSecret: config.clientSecret,
        callbackURL: config.callbackURL,
        passReqToCallback: true
    }, auth.buildPassportCallback(PROVIDER_TYPE, r));
    passport.use(googleStrategy);

    /**
     * @override
     */
    r.handleAuth = function(req, res, next)
    {
        passport.authenticate(PROVIDER_TYPE,{
            scope:
                [
                    'profile',
                    'email'
                ]
        })(req, res, next);
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
            userObject.firstName = profile._json.name.givenName;
        }

        if (!userObject.lastName)
        {
            userObject.lastName = profile._json.name.familyName;
        }

        if (!userObject.gender)
        {
            userObject.gender = profile._json.gender;
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
    r.load = function(properties, callback)
    {
        googleStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);

        });
    };

    return r;
};
