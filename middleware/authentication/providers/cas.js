var auth = require("../../../util/auth");

var CasStrategy = require('passport-cas').Strategy;
var AbstractProvider = require("./abstract");

/**
 * "cas" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "ssoBaseURL": "http://www.example.com/",
 *    "serverBaseURL": "http://localhost:3000",
 *    "validateURL": <for cas 2.0>
 */
class CasProvider extends AbstractProvider
{
    constructor(req, config)
    {
        super(req, config);

        if (!config.properties) {
            config.properties = {};
        }
        if (!config.properties.id) {
            config.properties.id = "name";
        }

        // passport
        this.casStrategy = new CasStrategy({
            "ssoBaseURL": config.ssoBaseURL,
            "serverBaseURL": config.serverBaseURL,
            "validateURL": config.validateURL,
            "passReqToCallback": true
        }, auth.buildPassportCallback(config, this));

        req.passport.use(this.casStrategy);
    };

    /**
     * @override
     */
    handleAuth(req, res, next)
    {
        req.passport.authenticate("cas")(req, res, next);
    };

    /**
     * @override
     */
    handleAuthCallback(req, res, next, cb)
    {
        req.passport.authenticate("cas", {
            session: false
        }, cb)(req, res, next);
    };

    /**
     * @override
     */
    load(properties, callback)
    {
        this.casStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };
}

module.exports = CasProvider;
