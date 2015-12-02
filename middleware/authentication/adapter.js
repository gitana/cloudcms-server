var request = require('request');
var path = require('path');

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

            var domain = req.gitana.datastore("principals");

            this.findUserForProvider(providerId, providerUserId, token, null, tokenSecret, null, domain, function(err, data) {

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
                domain.readPrincipal(data.user._doc).then(function() {
                    callback(null, this);
                });

            });

        });
    };

    var generateUserInfoObject = function(req, providerUserId, token, tokenSecret, profile, callback)
    {
        var userObject = {};

        // if user properties provided in config, copy those in
        if (config.user)
        {
            userObject = JSON.parse(JSON.stringify(config.user));
        }

        lib.handleSyncProfile(req, token, tokenSecret, profile, userObject, function(err) {
            callback(null, userObject);
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

        // if user properties provided in config, copy those in
        if (config.user)
        {
            userObject = JSON.parse(JSON.stringify(config.user));
        }

        // if existing user, layer sign-on onto existing user
        if (req.session.user)
        {
            userObject._doc = req.session.user._doc;
        }

        var domain = req.gitana.datastore("principals");

        lib.handleSyncProfile(req, token, tokenSecret, profile, userObject, function(err) {

            directory(req, function() {

                // THIS = directory

                this.createUserForProvider(providerId, providerUserId, userObject, token, null, tokenSecret, profile, domain, function(err, data) {

                    if (err)
                    {
                        callback(err);
                        return;
                    }

                    // read the user back
                    domain.readPrincipal(data.user._doc).then(function() {

                        var user = this;

                        lib.handleSyncAvatar(req, profile, user, function(err) {
                            callback(null, user);
                        });

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
            "tokenSecret": tokenSecret,
            "profile": profile,
            "providerId": lib.providerId(),
            "providerTitle": lib.providerTitle(),
            "providerUserId": providerUserId
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

                    if (err)
                    {
                        done(err);
                        return;
                    }

                    lib.handleSyncAvatar(req, profile, user, function(err) {

                        if (err)
                        {
                            done(err);
                            return;
                        }

                        user.update().then(function() {
                            done(err, user, info);
                        });
                    });
                });

                return;
            }

            generateUserInfoObject(req, providerUserId, token, tokenSecret, profile, function(err, userObject) {
                info.userObject = userObject;
            });

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

    r.downloadAndAttach = function(req, url, attachable, attachmentId, callback)
    {
        var targetUrl = req.gitanaConfig.baseURL + attachable.getUri() + "/attachments/" + attachmentId;

        // add "authorization" for OAuth2 bearer token
        var headers = {};
        headers["Authorization"] = req.gitana.platform().getDriver().getHttpHeaders()["Authorization"];

        request.get(url)
            .pipe(request.post({
                url: targetUrl,
                headers: headers
            }))
            .on("response", function(response) {
                callback();
            });
    };

    return r;
};

