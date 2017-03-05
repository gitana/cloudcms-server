'use strict';

/**
 * Module dependencies.
 */
var kcUtils = require('./utils');
var util = require("util");
var objectmerge = require("object-merge");
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var InternalOAuthError = require('passport-oauth').InternalOAuthError;


/**
 * `Strategy` constructor.
 *
 * When using keycloak as an OAuth2 provider, the AuthorizationURL and
 * TokenURL options are generated based on the `auth_server_url` and
 * `realm` options. You can use the `keycloak.json` file by setting
 * the `keycloakFile` option. You can find the contents for this file
 * from the `Applications->Installation` option, or from the
 * `OAuth Clients->Installation` option in your keycloak realm.
 * If you do not provide a `keycloak.json` file, you must provide
 * those in your options object.
 *
 * If you provide the `AuthorizationURL` and `TokenURL` values, these
 * will be replaced with the calculated values.
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `keycloakFile`     Absolute file path to your keycloak.json file.
 *   - `callbackURL`      URL to which KeyCloak will redirect the user after granting authentication.
 * OR:
 *   - `realm`            Name of your KeyCloak realm (if keycloakFile not specified.)
 *   - `auth_server_url`  Base URL for you Realm authorization endpoint.
 *   - `clientID`         This will match your `Application Name` or `OAuth Client Name`
 *   - `clientSecret`     If you have `Access Type` set to `confidential` this is required.
 *   - `callbackURL`      URL to which KeyCloak will redirect the user after granting authentication.
 *
 * Examples:
 *
 *    passport.use(new KeyCloakStrategy({
 *        clientID: 'myOauthClient',
 *        clientSecret: '6ee0f303-faef-42d7-ba8e-00cdec755c42',
 *        realm: 'MyKeyCloakRealm',
 *        auth_server_url: 'https://keycloak.example.com/auth',
 *        callbackURL: 'https://www.example.com/keycloak/callback'
 *      },
 *      function(accessToken, refreshToken, profile, done) {
 *        User.findOrCreate(..., function err, user) {
 *          done(err, user);
 *        });
 *      }
 *    });
 *
 *    passport.use(new KeyCloakStrategy({
 *        keycloakFile: '/path/to/keycloak.json'
 *        callbackURL:  'https://www.example.com/keycloak/callback'
 *      },
 *      function(accessToken, refreshToken, profile, done) {
 *        User.findOrCreate(..., function err, user) {
 *          done(err, user);
 *        });
 *      }
 *    });
 *
 *  @param {Object} options
 *  @param {Function} verify
 *  @api public
 */
var debug = require('debug')('keycloak.oauth2');
function Strategy(options, verify) {
    options = options || {};
    options.keycloakfile = options.keycloakFile || false;

    if (options.keycloakFile) {
        debug('Loading keyfile: '+options.keycloakFile);
        options = objectmerge({}, options, kcUtils.loadConfig(options.keycloakFile));
    }

    if (!options.realm) {
        throw new Error('Keycloak realm is required.');
    }

    if (!options.auth_server_url) {
        throw new Error('Keycloak auth_server_url is required.');
    }
    options = kcUtils.mapOptions(options);
    OAuth2Strategy.call(this, options, verify);

    this.options = options;
    this.name = 'keycloak';
    this.realm = options.realm;
}

util.inherits(Strategy, OAuth2Strategy);

/**
 * Retrieve user profile from Keycloak
 *
 * This function returns user profile information
 * The fields that are returned are dependent on
 * the Allowed Claims for the OAuth client that is
 * connecting.
 *
 *   - `provider`         always set to `keycloak`
 *   - `id`
 *   - `username`
 *   - `displayName`
 *   - `realm`            keycloak realm
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */
Strategy.prototype.userProfile = function(accessToken, done) {

    var userInfoURL = kcUtils.getUserInfoURL(this.options);
    var realm = this.realm;
    debug ("Calling "+ userInfoURL + " with token: " + accessToken);
    this._oauth2._useAuthorizationHeaderForGET = true;
    this._oauth2.get(userInfoURL, accessToken, function (err, body, res){
        try {
            if (err) {
                debug(JSON.stringify(err));
                return done(err);
            }
            debug('userProfile...'+body);
            var json = JSON.parse(body);

            var profile = { realm: realm,
                provider: 'keycloak' };
            profile.id = json.subject;
            profile.username = json.preferred_username;
            profile.displayname = profile.name;
            profile = objectmerge({}, profile, json);

            profile._raw = body;
            profile._json = json;
            debug('userProfile done.');
            return done(null, profile);
        } catch (e) {
            debug('userProfile error');
            return done(e);
        }
    });
};
module.exports = Strategy;