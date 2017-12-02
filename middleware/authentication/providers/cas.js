var auth = require("../../../util/auth");

var passport = require("passport");
var CasStrategy = require('passport-cas').Strategy;

var extend = require("extend-with-super");

/**
 * "cas" Authentication Provider
 *
 * Provider-specific configuration:
 *
 *    "ssoBaseURL": "http://www.example.com/",
 *    "serverBaseURL": "http://localhost:3000",
 *    "validateURL": <for cas 2.0>
 *
 * @return {Function}
 */
exports = module.exports = function(PROVIDER_ID, PROVIDER_TYPE, config)
{
    if (!config.properties) {
        config.properties = {};
    }
    if (!config.properties.id) {
        config.properties.id = "name";
    }

    var base = require("./abstract")(PROVIDER_ID, PROVIDER_TYPE, config);

    // passport
    var casStrategy = new CasStrategy({
        "ssoBaseURL": config.ssoBaseURL,
        "serverBaseURL": config.serverBaseURL,
        "validateURL": config.validateURL,
        "passReqToCallback": true
    }, auth.buildPassportCallback(PROVIDER_TYPE, r));
    passport.use(casStrategy);

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
    r.load = function(properties, callback)
    {
        casStrategy.userProfile(properties.token, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, profile);
        });
    };

    return extend(base, r);
};

