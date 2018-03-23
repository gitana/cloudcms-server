var auth = require("../../../util/auth");

var FacebookStrategy = require('passport-facebook').Strategy;
var AbstractProvider = require("./abstract");

if (!process.configuration) {
    process.configuration = {};
}
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
 *    "appId": "Application ID",
 *    "appSecret": "Application secret",
 *
 */
class FacebookProvider extends AbstractProvider
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
        this.facebookStrategy = new FacebookStrategy({
            clientID: config.appId,
            clientSecret: config.appSecret,
            callbackURL: config.callbackURL,
            passReqToCallback: true
        }, auth.buildPassportCallback(config, this));

        req.passport.use(this.facebookStrategy);
    }

    /**
     * @override
     */
    handleAuth(req, res, next)
    {
        req.passport.authenticate("facebook")(req, res, next);
    };

    /**
     * @override
     */
    handleAuthCallback(req, res, next, cb)
    {
        req.passport.authenticate("facebook", {
            session: false
        }, cb)(req, res, next);
    };

    /**
     * @override
     */
    parseProfile(req, profile, callback)
    {
        super.parseProfile(req, profile, function(err, userObject, groupsArray, mandatoryGroupsArray) {

            if (err) {
                return callback(err);
            }

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

            callback(null, userObject, groupsArray, mandatoryGroupsArray);
        });
    };

    /**
     * @override
     */
    load(properties, callback)
    {
        this.facebookStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };


}

module.exports = FacebookProvider;
