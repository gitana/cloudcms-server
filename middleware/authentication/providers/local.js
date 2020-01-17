var auth = require("../../../util/auth");

var LocalStrategy = require('passport-local');
var AbstractProvider = require("./abstract");

if (!process.configuration) {
    process.configuration = {};
}
if (!process.configuration.providers) {
    process.configuration.providers = {};
}
if (!process.configuration.providers.local) {
    process.configuration.providers.local = {};
}

/**
 * "local" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "usernameField": "",
 *    "passwordField": "",
 *
 */
class LocalProvider extends AbstractProvider
{
    constructor(req, config)
    {
        super(req, config);

        if (!config.usernameField) {
            config.usernameField = "user[email]";
        }

        if (!config.passwordField) {
            config.passwordField = "user[password]";
        }

        // passport
        this.localStrategy = new LocalStrategy({
            usernameField: config.usernameField,
            passwordField: config.passwordField,
            callbackURL: config.callbackURL,
            passReqToCallback: true
        }, function(email, password, done) {

            var info = {};

            info.providerId = config.id;
            info.providerUserId = email;
            //info.token = token;
            //info.refreshToken = refreshToken;

            done(null, {}, info);
        });

        req.passport.use(this.localStrategy);
    }

    /**
     * @override
     */
    handleAuth(req, res, next)
    {
        req.passport.authenticate("local")(req, res, next);
    };

    /**
     * @override
     */
    handleAuthCallback(req, res, next, cb)
    {
        req.passport.authenticate("local", {
            session: true
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
                if (x.length === 2)
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
        this.localStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };


}

module.exports = LocalProvider;
