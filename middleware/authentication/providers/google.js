var auth = require("../../../util/auth");

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var AbstractProvider = require("./abstract");

if (!process.configuration) {
    process.configuration = {};
}
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
 */
class GoogleProvider extends AbstractProvider
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

        this.googleStrategy = new GoogleStrategy({
            clientID: config.clientID,
            clientSecret: config.clientSecret,
            callbackURL: config.callbackURL,
            passReqToCallback: true
        }, auth.buildPassportCallback(config, this));

        req.passport.use(this.googleStrategy);

    }

    /**
     * @override
     */
    handleAuth(req, res, next)
    {
        req.passport.authenticate("google",{
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
    handleAuthCallback(req, res, next, cb)
    {
        req.passport.authenticate("google", {
            session: false
        }, cb)(req, res, next);
    };

    /**
     * @override
     */
    parseProfile(req, profile, callback)
    {
        super.parseProfile(req, profile, function(err, userObject, groupsArray) {

            if (err) {
                return callback(err);
            }

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

            callback(null, userObject, groupsArray);

        });
    };

    /**
     * @override
     */
    load(properties, callback)
    {
        this.googleStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };
}

module.exports = GoogleProvider;
