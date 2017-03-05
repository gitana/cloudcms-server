var auth = require("../../../util/auth");

var passport = require("passport");
var TwitterStrategy = require('passport-twitter').Strategy;

if (!process.configuration.providers) {
    process.configuration.providers = {};
}
if (!process.configuration.providers.twitter) {
    process.configuration.providers.twitter = {};
}
if (process.env.CLOUDCMS_AUTH_PROVIDERS_TWITTER_ENABLED === "true") {
    process.configuration.providers.twitter.enabled = true;
}

/**
 * "twitter" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "consumerKey": "",
 *    "consumerSecret": ""
 *
 * @return {Function}
 */
exports = module.exports = function(PROVIDER_ID, PROVIDER_TYPE, config)
{
    var r = require("./abstract")(PROVIDER_ID, PROVIDER_TYPE, config);

    // passport
    var twitterStrategy = new TwitterStrategy({
        consumerKey: config.consumerKey,
        consumerSecret: config.consumerSecret,
        callbackURL: config.callbackURL,
        passReqToCallback: true
    }, auth.buildPassportCallback(PROVIDER_TYPE, r));
    passport.use(twitterStrategy);

    /**
     * @override
     */
    r.profileIdentifier = function(profile)
    {
        return profile.id;
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

        // TODO: nothing much is actually provided from twitter
        // is there anything here we can extract from profile?

        return userObject;
    };

    r.syncAvatar = function(gitanaUser, profile, callback)
    {
        // sync avatar photo
        if (profile && profile.photos && profile.photos.length > 0)
        {
            // use the 0th one as the avatar
            var photoUrl = profile.photos[0].value;

            // download and attach to user
            auth.syncAttachment(gitanaUser, "avatar", photoUrl, function(err) {
                callback(err);
            });

            return;
        }

        callback();
    };

    /**
     * @override
     */
    r.load = function(token, callback)
    {
        //Strategy.prototype.userProfile = function(token, tokenSecret, params, done) {
        twitterStrategy.userProfile(token, function(err, user) {
            callback(err, user);
        });
    };

    return r;
};

