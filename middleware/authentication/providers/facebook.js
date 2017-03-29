var auth = require("../../../util/auth");

var passport = require("passport");
var FacebookStrategy = require('passport-facebook').Strategy;

if (!process.configuration.providers) {
    process.configuration.providers = {};
}
if (!process.configuration.providers.facebook) {
    process.configuration.providers.facebook = {};
}
if (process.env.CLOUDCMS_AUTH_PROVIDERS_FACEBOOK_ENABLED === "true") {
    process.configuration.providers.facebook.enabled = true;
}

/**
 * "facebook" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "appId": "",
 *    "appSecret": "",
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
    var facebookStrategy = new FacebookStrategy({
        clientID: config.appId,
        clientSecret: config.appSecret,
        callbackURL: config.callbackURL,
        passReqToCallback: true
    }, auth.buildPassportCallback(PROVIDER_TYPE, r));
    passport.use(facebookStrategy);

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

        var name = profile.displayName;
        if (profile._json && profile._json.name)
        {
            name = profile._json.name;
        }
        if (name)
        {
            var x = name.split(" ");
            if (x.length == 2)
            {
                userObject.firstName = x[0];
                userObject.lastName = x[1];
            }
        }

        userObject.facebookId = profile.id;

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
        facebookStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };

    return r;
};

