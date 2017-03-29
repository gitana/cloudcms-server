var auth = require("../../../util/auth");

var passport = require("passport");
var GithubStrategy = require('passport-github').Strategy;

if (!process.configuration.providers) {
    process.configuration.providers = {};
}
if (!process.configuration.providers.github) {
    process.configuration.providers.github = {};
}
if (process.env.CLOUDCMS_AUTH_PROVIDERS_GITHUB_ENABLED === "true") {
    process.configuration.providers.github.enabled = true;
}

/**
 * "github" Authentication Provider
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
    var githubStrategy = new GithubStrategy({
        clientID: config.clientID,
        clientSecret: config.clientSecret,
        callbackURL: config.callbackURL,
        passReqToCallback: true
    }, auth.buildPassportCallback(PROVIDER_TYPE, r));
    passport.use(githubStrategy);

    /**
     * @override
     */
    r.handleAuth = function(req, res, next)
    {
        passport.authenticate(PROVIDER_TYPE,{
            scope: ['user']
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

        // TODO: extract properties

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
        githubStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };

    return r;
};
