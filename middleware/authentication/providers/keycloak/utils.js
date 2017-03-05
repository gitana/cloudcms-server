'use strict';
var util = require('util')
    , debug = require('debug')('keycloak.utils')
    , fs = require('fs');

var Utils = {
    /**
     * Transform "-" to "_" to make it easier to consume
     * keycloak.json. Returns the transformed config object.
     *
     * @param {Object} config
     * @return {Object}
     * @api protected
     */
    transform : function(config) {
        var newConfig = {};
        var list = Object.keys(config);

        list.forEach(function(key){
            var newIndex = key.replace(/-/g, "_");
            newConfig[newIndex] = config[key];
        });
        return newConfig;
    },

    /**
     * Return options loaded from the keycloak.json file.
     *
     * This function will call the `transform` function in
     * order to translate "-" to "_" in config parameter names.
     *
     * @param {Object} config
     * @return {Object}
     * @api public
     */
    loadConfig : function (config) {
        var json = config;
        if (fs.existsSync(config)) {
            return this.transform(require(config));
        } else if (fs.existsSync(__dirname + config)) {
            debug ('File '+config+' does not exist');
            return this.transform(require(__dirname + config));
        } else {
            debug ('File '+__dirname + config+' does not exist');
            throw new Error("Unable to read config options from: "+config);
        }
    },

    /**
     * Return mapped keycloak.json config options to the standard OAuth 2.0
     * config options.
     *
     * @param {Object} options
     * @return {Object}
     * @api public
     */
    mapOptions : function(options) {
        options.authorizationURL = this.getAuthURL(options);
        options.tokenURL = this.getTokenURL(options);
        if (!options.clientID) {
            options.clientID = options.resource;
        }
        if (!options.clientSecret) {
            options.clientSecret = "xx"; // We only have a secret if this isn't a public client
            if (!options.public_client) {
                if (options.credentials) {
                    options.clientSecret = options.credentials.secret;
                } else {
                    throw new Error('Configuration requires credentials.secret');
                }
            }
        }
        return options;
    },

    /**
     * Return the AuthorizationURL for the KeyCloak server.
     *
     * This function constructs the OAuth 2.0 authorization URL
     * based on KeyCloak server_auth_url and realm.
     *
     * @param {Object} options
     * @returns {String}
     * @api public
     */
    getAuthURL : function(options) {
        var url = util.format('%s/realms/%s/protocol/openid-connect/auth',
            options.auth_server_url,
            encodeURIComponent(options.realm));
        debug('authorizationURL: '+url);
        return url;
    },

    /**
     * Return the TokenURL for the KeyCloak server.
     *
     * This function constructs the OAuth 2.0 token URL
     * based on KeyCloak server_auth_url and realm.
     *
     * @param {Object} options
     * @returns {String}
     * @api public
     */
    getTokenURL : function(options) {
        var url = util.format('%s/realms/%s/protocol/openid-connect/token',
            options.auth_server_url,
            encodeURIComponent(options.realm));
        debug('tokenURL: '+url);
        return url;
    },

    /**
     * Return the userinfo URL for the KeyCloak server.
     *
     * This function constructs the OAuth 2.0 userinfo URL
     * based on KeyCloak server_auth_url and realm.
     *
     * @param {Object} options
     * @returns {String}
     * @api public
     */
    getUserInfoURL : function(options) {
        var url = util.format('%s/realms/%s/protocol/openid-connect/userinfo',
            options.auth_server_url,
            encodeURIComponent(options.realm));
        debug('userInfoURL: '+url);
        return url;
    }
}

module.exports = Utils;