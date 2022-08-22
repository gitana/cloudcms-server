//var auth = require("../../../util/auth");

var SamlStrategy = require('passport-saml').Strategy;
var AbstractProvider = require("./abstract");

if (!process.configuration) {
    process.configuration = {};
}
if (!process.configuration.providers) {
    process.configuration.providers = {};
}
if (!process.configuration.providers.saml) {
    process.configuration.providers.saml = {};
}
if (process.env.CLOUDCMS_AUTH_PROVIDERS_SAML_ENABLED === "true") {
    process.configuration.providers.saml.enabled = true;
}

/**
 * "SAML" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "entryPoint": "http://localhost:9090/auth/realms/master/protocol/saml",
 *    "issuer": "myapp"
 *
 * Where:
 *
 *    - "entrypoint" is the URL of the SAML endpoint
 *    - "issuer" is the name of the client
 *
 * This provider does NOT support loading profiles.  As such, it only works with trusted tokens.
 * A JWT (or similar) request adapter must be enabled and the token must contain everything needed.
 *
 * The SAML endpoint must write the JWT token down into the browser (cookie) after login.
 *
 * @return {Function}
 */
class SAMLProvider extends AbstractProvider
{
    constructor(req, config)
    {
        super(req, config);

        if (!config.properties) {
            config.properties = {};
        }
        if (!config.properties.id) {
            config.properties.id = "nameID";
        }

        // strategy config
        var samlConfig = {};
        samlConfig.acceptedClockSkewMs = -1; // because SamlStrategy does not handle timezone changes correctly with before/after timestamps
        samlConfig.passReqToCallback = true;
        if (config.entryPoint) {
            samlConfig.entryPoint = config.entryPoint;
        }
        if (config.cert) {
            samlConfig.cert = config.cert;
        }
        if (config.callbackURL) {
            samlConfig.callbackUrl = "http://localhost:5000" + config.callbackURL;
        }
        if (config.issuer) {
            samlConfig.issuer = config.issuer;
        }

        // bind strategy to passport
        var provider = this;
        this.samlStrategy = new SamlStrategy(samlConfig, function (req, profile, done) {
            var info = {};

            info.providerId = config.id;
            info.providerUserId = provider.userIdentifier(profile);

            done(null, profile, info);
        });

        req.passport.use(this.samlStrategy);
    }

    /**
     * @override
     */
    handleAuth(req, res, next)
    {
        req.passport.authenticate("saml", {
            failureRedirect: this.config.failureRedirect,
            failureFlash: true
        })(req, res, next);
    };

    /**
     * @override
     */
    handleAuthCallback(req, res, next, cb)
    {
        req.passport.authenticate("saml", {
            session: false,
            failureFlash: true
        }, cb)(req, res, next);
    };
}

module.exports = SAMLProvider;
