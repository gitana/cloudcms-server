var auth = require("../../../util/auth");

var TwitterStrategy = require('passport-twitter').Strategy;
var AbstractProvider = require("./abstract");

if (!process.configuration) {
    process.configuration = {};
}
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
class TwitterProvider extends AbstractProvider
{
    constructor(req, config)
    {
        super(req, config);

        if (!config.properties) {
            config.properties = {};
        }
        if (!config.properties.id) {
            config.properties.id = "id";
        }

        // passport
        this.twitterStrategy = new TwitterStrategy({
            consumerKey: config.consumerKey,
            consumerSecret: config.consumerSecret,
            callbackURL: config.callbackURL,
            passReqToCallback: true
        }, auth.buildPassportCallback(config, provider));

        req.passport.use(this.twitterStrategy);
    }

    /**
     * @override
     */
    handleAuth(req, res, next)
    {
        req.passport.authenticate("twitter")(req, res, next);
    };

    /**
     * @override
     */
    handleAuthCallback(req, res, next, cb)
    {
        req.passport.authenticate("twitter", {
            session: false
        }, cb)(req, res, next);
    };

    /**
     * @override
     */
    parseProfile(profile)
    {
        var userObject = this._super(profile);

        // TODO: not much provided from Twitter, add any custom extractions?

        return userObject;
    };

    /**
     * @override
     */
    syncAvatar(gitanaUser, profile, callback)
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
    load(properties, callback)
    {
        this.twitterStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);

        });
    };
}

module.exports = TwitterProvider;
