var auth = require("../../../util/auth");

var GithubStrategy = require('passport-github').Strategy;
var AbstractProvider = require("./abstract");

if (!process.configuration) {
    process.configuration = {};
}
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
 */
class GithubProvider extends AbstractProvider
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
        this.githubStrategy = new GithubStrategy({
            clientID: config.clientID,
            clientSecret: config.clientSecret,
            callbackURL: config.callbackURL,
            passReqToCallback: true
        }, auth.buildPassportCallback(config, this));

        req.passport.use(this.githubStrategy);
    }

    /**
     * @override
     */
    handleAuth(req, res, next)
    {
        req.passport.authenticate("github",{
            scope: ['user']
        })(req, res, next);
    };

    /**
     * @override
     */
    handleAuthCallback(req, res, next, cb)
    {
        req.passport.authenticate("github", {
            session: false
        }, cb)(req, res, next);
    };

    /**
     * @override
     */
    load(properties, callback)
    {
        this.githubStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };
}

module.exports = GithubProvider;
