var auth = require("../../../util/auth");

var passport = require("passport");
var LinkedInStrategy = require('passport-linkedin').Strategy;

var extend = require("extend-with-super");

if (!process.configuration.providers) {
    process.configuration.providers = {};
}
if (!process.configuration.providers.linkedin) {
    process.configuration.providers.linkedin = {};
}
if (process.env.CLOUDCMS_AUTH_PROVIDERS_LINKEDIN_ENABLED === "true") {
    process.configuration.providers.linkedin.enabled = true;
}

/**
 * "linkedin" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "apiKey": "",
 *    "apiSecret": "",
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

    var base = require("./abstract")(PROVIDER_ID, PROVIDER_TYPE, config);

    // passport
    var linkedinStrategy = new LinkedInStrategy({
        consumerKey: config.apiKey,
        consumerSecret: config.apiSecret,
        callbackURL: config.callbackURL,
        passReqToCallback: true
    }, auth.buildPassportCallback(PROVIDER_TYPE, r));
    passport.use(linkedinStrategy);

    //////

    var r = {};

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
            failureRedirect: config.failureRedirect,
            session: false
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
            userObject.firstName = profile._json.firstName;
        }

        if (!userObject.lastName)
        {
            userObject.lastName = profile._json.lastName;
        }

        return userObject;
    };

    /**
     * @override
     */
    r.load = function(properties, callback)
    {
        linkedinStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);

        });
    };

    return extend(base, r);
};

