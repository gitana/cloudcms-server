var auth = require("../../../util/auth");

var passport = require("passport");
var KeyCloakStrategy = require("./keycloak/index");

var extend = require("extend-with-super");

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
exports = module.exports = function(PROVIDER_ID, PROVIDER_TYPE, config)
{
    if (!config.properties) {
        config.properties = {};
    }
    if (!config.properties.id) {
        config.properties.id = "username";
    }

    var base = require("./abstract")(PROVIDER_ID, PROVIDER_TYPE, config);

    // passport
    var keycloakStrategy = new KeyCloakStrategy({
        "clientID": config.clientID,
        "clientSecret": config.clientSecret,
        "realm": config.realm,
        "auth_server_url": config.auth_server_url,
        "callbackURL": config.callbackURL,
        "passReqToCallback": true
    }, auth.buildPassportCallback(PROVIDER_TYPE, r));
    passport.use(keycloakStrategy);

    //////

    var r = {};

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
            successRedirect: config.successRedirect,
            failureRedirect: config.failureRedirect
        }, cb)(req, res, next);
    };

    /**
     * @override
     */
    r.parseProfile = function(profile)
    {
        var userObject = this._super(profile);

        // TODO: add in any custom extractions

        return userObject;
    };

    /**
     * @override
     */
    r.load = function(properties, callback)
    {
        keycloakStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };

    return extend(base, r);
};

