var auth = require("../../../util/auth");

var KeyCloakStrategy = require("./keycloak/index");
var AbstractProvider = require("./abstract");

/**
 * "keycloak" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "clientID": "myOauthClient",
 *    "clientSecret": "6ee0f303-faef-42d7-ba8e-00cdec755c42",
 *    "realm": "MyKeyCloakRealm",
 *    "auth_server_url": "https://keycloak.example.com/auth"
 *
 * @return {Function}
 */
class KeyCloakProvider extends AbstractProvider
{
    constructor(req, config)
    {
        super(req, config);

        if (!config.properties) {
            config.properties = {};
        }
        if (!config.properties.id) {
            config.properties.id = "username";
        }

        this.keycloakStrategy = new KeyCloakStrategy({
            "clientID": config.clientID,
            "clientSecret": config.clientSecret,
            "realm": config.realm,
            "auth_server_url": config.auth_server_url,
            "callbackURL": config.callbackURL,
            "passReqToCallback": true
        }, auth.buildPassportCallback(config, this));

        req.passport.use(this.keycloakStrategy);
    }

    /**
     * @override
     */
    handleAuth(req, res, next)
    {
        req.passport.authenticate("keycloak")(req, res, next);
    };

    /**
     * @override
     */
    handleAuthCallback(req, res, next, cb)
    {
        req.passport.authenticate("keycloak", {
            session: false
        }, cb)(req, res, next);
    };

    /**
     * @override
     */
    parseProfile(req, profile, callback)
    {
        super.parseProfile(req, profile, function(err, userObject, groupsArray, mandatoryGroupsArray) {
            callback(err, userObject, groupsArray, mandatoryGroupsArray);
        });
    };

    /**
     * @override
     */
    load(properties, callback)
    {
        this.keycloakStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };
}

module.exports = KeyCloakProvider;
