var auth = require("../../../util/auth");

var LinkedInStrategy = require('passport-linkedin').Strategy;
var AbstractProvider = require("./abstract");

if (!process.configuration) {
    process.configuration = {};
}
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
class LinkedInProvider extends AbstractProvider
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

        this.linkedinStrategy = new LinkedInStrategy({
            consumerKey: config.apiKey,
            consumerSecret: config.apiSecret,
            callbackURL: config.callbackURL,
            passReqToCallback: true
        }, auth.buildPassportCallback(config, provider));

        req.passport.use(this.linkedinStrategy);
    }

    /**
     * @override
     */
    handleAuth(req, res, next)
    {
        req.passport.authenticate("linkedin")(req, res, next);
    };

    /**
     * @override
     */
    handleAuthCallback(req, res, next, cb)
    {
        req.passport.authenticate("linkedin", {
            session: false
        }, cb)(req, res, next);
    };

    /**
     * @override
     */
    parseProfile(profile)
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
    load(properties, callback)
    {
        this.linkedinStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);

        });
    };
}

module.exports = LinkedInProvider;
