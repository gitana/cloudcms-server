var uuid = require("node-uuid");

/**
 * Helper methods for working with domains, identities and connections.
 *
 * @return {Function}
 */
exports = module.exports = function(providerId, lib, config)
{
    var directory = function(req, callback)
    {
        var platform = req.gitana.platform();
        var domain = req.gitana.datastore("principals");

        Chain(platform).readDirectory(domain.defaultDirectoryId).then(function() {

            if (!this.findUserForProvider)
            {
                this.findUserForProvider = function(providerId, providerUserId, token, refreshToken, tokenSecret, profile, callback)
                {
                    var self = this;

                    var params = {
                        "domainId": domain.getId(),
                        "providerId": providerId,
                        "providerUserId": providerUserId
                    };

                    var payload = {
                        "token": token,
                        "refreshToken": refreshToken,
                        "tokenSecret": tokenSecret,
                        "profile": profile
                    };

                    var uriFunction = function()
                    {
                        return self.getUri() + "/connections/finduser";
                    };

                    return this.trap(function(err) {
                        callback(err);
                        return;
                    }).chainPostResponse(this, uriFunction, params, payload).then(function(response) {
                        callback(null, response);
                    });
                };
            }

            if (!this.createUserForProvider)
            {
                this.createUserForProvider = function(providerId, providerUserId, userObject, token, refreshToken, tokenSecret, profile, callback)
                {
                    var self = this;

                    var params = {
                        "domainId": domain.getId(),
                        "providerId": providerId,
                        "providerUserId": providerUserId
                    };

                    var payload = {
                        "user": userObject,
                        "token": token,
                        "refreshToken": refreshToken,
                        "tokenSecret": tokenSecret,
                        "profile": profile
                    };

                    var uriFunction = function()
                    {
                        return self.getUri() + "/connections/createuser";
                    };

                    return this.trap(function(err) {
                        callback(err);
                        return;
                    }).chainPostResponse(this, uriFunction, params, payload).then(function(response) {
                        callback(null, response);
                    });
                };
            }

            callback.call(this);
        });
    };

    /**
     * Loads a user from Cloud CMS for the given connection token and secret.
     *
     * @type {Function}
     */
    var findUserForProvider = function(req, providerUserId, token, tokenSecret, callback)
    {
        directory(req, function() {

            // THIS = directory

            this.findUserForProvider(providerId, providerUserId, token, null, tokenSecret, null, function(err, data) {

                if (err)
                {
                    callback(err);
                    return;
                }

                if (!data.user)
                {
                    // nothing found
                    callback();
                    return;
                }

                // read the user
                var domain = req.gitana.datastore("principals");
                domain.readPrincipal(data.user._doc).then(function() {
                    callback(null, this);
                });

            });

        });
    };

    /**
     * Automatically registers / creates the user for this facebook profile.
     *
     * @param req
     * @param providerUserId
     * @param token
     * @param tokenSecret
     * @param profile
     * @param callback
     */
    var createUserForProvider = function(req, providerUserId, token, tokenSecret, profile, callback)
    {
        var userObject = {};

        // if existing user, layer sign-on onto existing user
        if (req.session.user)
        {
            userObject._doc = req.session.user._doc;
        }

        lib.handleSyncProfile(req, token, tokenSecret, profile, userObject, function(err) {

            directory(req, function() {

                // THIS = directory

                this.createUserForProvider(providerId, providerUserId, userObject, token, null, tokenSecret, profile, function(err, data) {

                    if (err)
                    {
                        callback(err);
                        return;
                    }

                    // read the user
                    var domain = req.gitana.datastore("principals");
                    domain.readPrincipal(data.user._doc).then(function() {
                        callback(null, this);
                    });

                });
            });
        });
    };

    var r = {};

    r.verifyCallback = function(req, token, tokenSecret, profile, done)
    {
        var providerUserId = lib.providerUserId(profile);

        var info = {
            "token": token,
            "tokenSecret": tokenSecret
        };

        // loads the existing user for this profile (if it exists)
        findUserForProvider(req, providerUserId, token, tokenSecret, function(err, user) {

            if (err)
            {
                done(err);
                return;
            }

            if (user)
            {
                lib.handleSyncProfile(req, token, tokenSecret, profile, user, function(err) {
                    user.update().then(function() {
                        done(err, user, info);
                    });
                });

                return;
            }

            if (config.autoRegister)
            {
                createUserForProvider(req, providerUserId, token, tokenSecret, profile, function(err, user) {
                    done(err, user, info);
                });
                return;
            }

            // nothing found
            done(null, null, info);
        });
    };

    r.syncProfile = function(profile, user, callback)
    {
        if (!user.profiles)
        {
            user.profiles = {};
        }

        user.profiles[providerId] = profile;

        callback();
    };

    return r;
};

