var path = require('path');
var fs = require('fs');
var util = require("./util");
var request = require("request");
var http = require("http");
var https = require("https");

// least-recently-used cache of size 100
var SYNC_USER_CACHE = require("lru-cache")(100);

// trusted profile cache size 100
var TRUSTED_PROFILE_CACHE = require("lru-cache")(100);

exports = module.exports;

// additional methods for Gitana driver
var Gitana = require("gitana");

Gitana.Directory.prototype.findUserForProvider = function(domain, providerId, providerUserId, callback)
{
    var self = this;

    var params = {
        "domainId": domain.getId(),
        "providerId": providerId,
        "providerUserId": providerUserId
    };

    var uriFunction = function()
    {
        return self.getUri() + "/connections/finduser";
    };

    return this.trap(function(err) {
        callback(err);
        return false;
    }).chainPostResponse(this, uriFunction, params).then(function(response) {
        callback(null, response);
    });
};

Gitana.Directory.prototype.createUserForProvider = function(domain, providerId, providerUserId, token, refreshToken, userObject, callback)
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
        "refreshToken": refreshToken
    };

    var uriFunction = function()
    {
        return self.getUri() + "/connections/createuser";
    };

    return this.trap(function(err) {
        callback(err);
        return false;
    }).chainPostResponse(this, uriFunction, params, payload).then(function(response) {
        callback(null, response);
    });
};

var directory = function(domain, callback)
{
    Chain(domain.getPlatform()).readDirectory(domain.defaultDirectoryId).then(function() {
        callback.call(this);
    });
};

/**
 * Loads a user from Cloud CMS for the given connection token and secret.
 *
 * @type {Function}
 */
var findUserForProvider = exports.findUserForProvider = function(domain, providerId, providerUserId, callback)
{
    directory(domain, function() {

        // THIS = directory

        this.findUserForProvider(domain, providerId, providerUserId, function(err, response) {

            if (err)
            {
                return callback(err);
            }

            if (!response.user)
            {
                // nothing found
                return callback();
            }

            // read the user
            Chain(domain).readPrincipal(response.user._doc).then(function() {
                callback(null, this);
            });

        });

    });
};

/**
 * Loads a user from Cloud CMS for the given connection token and secret.
 *
 * @type {Function}
 */
var updateUserForProvider = exports.updateUserForProvider = function(domain, providerId, providerUserId, token, refreshToken, userObject, callback)
{
    findUserForProvider(domain, providerId, providerUserId, function(err, user) {

        if (err)
        {
            return callback(err);
        }

        if (!user)
        {
            return callback();
        }

        if (!userObject)
        {
            return callback(null, user);
        }

        Chain(user).then(function() {

            if (userObject)
            {
                for (var k in userObject)
                {
                    if (k === "name")
                    {
                        // skip
                    }
                    else if (k === "_doc")
                    {
                        // skip
                    }
                    else
                    {
                        if (!userObject[k])
                        {
                            delete this[k];
                        }
                        else
                        {
                            this[k] = userObject[k];
                        }
                    }
                }
            }

            this.trap(function(e) {
                console.log("Failed on updateUserForProvider: " + e);
                callback(e);
                return false;
            }).update().then(function() {
                callback(null, this);
            });
        });
    });
};

/**
 * Automatically registers / creates the user for the user object.
 *
 * @param req
 * @param providerId
 * @param providerUserId
 * @param userObject
 * @param token
 * @param userObject
 * @param callback
 */
var createUserForProvider = exports.createUserForProvider = function(domain, providerId, providerUserId, token, refreshToken, userObject, callback)
{
    directory(domain, function() {

        // THIS = directory

        this.createUserForProvider(domain, providerId, providerUserId, token, refreshToken, userObject, function(err, data) {

            if (err)
            {
                return callback(err);
            }

            // read the user back
            Chain(domain).readPrincipal(data.user._doc).then(function() {
                callback(null, this);
            });
        });
    });
};

var buildPassportCallback = exports.buildPassportCallback = function(providerId, provider)
{
    return function(req, token, refreshToken, profile, done)
    {
        var info = {};
        info.providerId = providerId;
        info.providerUserId = provider.userIdentifier(profile);
        info.token = token;
        info.refreshToken = refreshToken;

        done(null, profile, info);
    };
};

/**
 * Ensures that the given user exists in Cloud CMS.
 *
 * @param domain
 * @param providerId
 * @param providerUserId
 * @param token
 * @param refreshToken
 * @param userObject
 * @param callback (err, gitanaUser)
 */
var syncUser = exports.syncUser = function(domain, providerId, providerUserId, token, refreshToken, userObject, callback)
{
    // take out a lock
    _LOCK([domain._doc, providerId, providerUserId], function (releaseLockFn) {

        findUserForProvider(domain, providerId, providerUserId, function (err, gitanaUser) {

            if (err)
            {
                releaseLockFn();
                return callback(err);
            }

            // if we already found the user, update it
            if (gitanaUser)
            {
                return updateUserForProvider(domain, providerId, providerUserId, token, refreshToken, userObject, function (err, gitanaUser) {

                    if (err)
                    {
                        releaseLockFn();
                        return callback(err);
                    }

                    gitanaUser.reload().then(function () {
                        releaseLockFn();
                        callback(null, this);
                    });
                });
            }

            // create
            createUserForProvider(domain, providerId, providerUserId, token, refreshToken, userObject, function (err, gitanaUser) {

                if (err)
                {
                    releaseLockFn();
                    return callback(err);
                }

                releaseLockFn();
                callback(err, gitanaUser);
            });
        });
    });
};

var syncAttachment = exports.syncAttachment = function(gitanaUser, attachmentId, url, callback)
{
    var baseURL = gitanaUser.getDriver().options.baseURL;
    var authorizationHeader = gitanaUser.getDriver().getHttpHeaders()["Authorization"];

    var targetUrl = baseURL + gitanaUser.getUri() + "/attachments/" + attachmentId;

    // add "authorization" for OAuth2 bearer token
    var headers = {};
    headers["Authorization"] = authorizationHeader;

    request.get(url).pipe(request.post({
        url: targetUrl,
        headers: headers
    })).on("response", function(response) {
        callback();
    });
};

var _LOCK = function(lockIdentifiers, workFunction)
{
    process.locks.lock(lockIdentifiers.join("_"), workFunction);
};

var syncProfile = exports.syncProfile = function(req, res, domain, providerId, provider, profile, token, refreshToken, callback)
{
    var userObject = provider.parseProfile(profile);
    var providerConfig = provider.providerConfiguration();
    var providerUserId = provider.userIdentifier(profile);

    var key = token;

    var _syncUser = function(key, domain, providerId, providerConfig, providerUserId, token, refreshToken, userObject, callback) {
        var gitanaUser = SYNC_USER_CACHE.get(key);
        if (gitanaUser)
        {
            return callback(null, gitanaUser);
        }

        // take out a lock
        _LOCK([domain._doc, providerId, providerUserId], function (releaseLockFn) {

            __syncUser(key, domain, providerId, providerConfig, providerUserId, token, refreshToken, userObject, function(err, gitanaUser) {

                if (err) {
                    releaseLockFn();
                    return callback(err);
                }

                if (gitanaUser) {
                    SYNC_USER_CACHE.set(key, gitanaUser);
                }

                releaseLockFn();
                return callback(null, gitanaUser);
            });
        });
    };

    var __syncUser = function(key, domain, providerId, providerConfig, providerUserId, token, refreshToken, userObject, callback) {

        // do we already have a gitana user?
        findUserForProvider(domain, providerId, providerUserId, function (err, gitanaUser) {

            if (err) {
                return callback(err);
            }

            if (gitanaUser)
            {
                updateUserForProvider(domain, providerId, providerUserId, token, refreshToken, userObject, function (err) {

                    if (err) {
                        return callback(err);
                    }

                    gitanaUser.reload().then(function () {
                        callback(null, this);
                    });
                });
                return;
            }

            if (!providerConfig.autoRegister) {
                return callback();
            }

            createUserForProvider(domain, providerId, providerUserId, token, refreshToken, userObject, function (err, gitanaUser) {

                if (err) {
                    return callback(err);
                }

                callback(null, gitanaUser);
            });

        })
    };

    var _connectUser = function(key, gitanaUser, callback) {

        var appHelper = Gitana.APPS[key];
        if (appHelper)
        {
            // console.log("CONNECT USER LOADED FROM CACHE, APPS");
            return callback(null, appHelper.platform(), appHelper, key);
        }

        var platform = Gitana.PLATFORM_CACHE(key);
        if (platform)
        {
            // console.log("CONNECT USER LOADED FROM CACHE, PLATFORM");
            return callback(null, platform, null, key);
        }

        impersonate(req, key, gitanaUser, function(err, platform, appHelper, key) {
            callback(err, platform, appHelper, key);
        });
    };

    _syncUser(key, domain, providerId, providerConfig, providerUserId, token, refreshToken, userObject, function(err, gitanaUser) {

        if (err) {
            return callback(err);
        }

        // no user found
        if (!gitanaUser) {
            return callback();
        }

        _connectUser(key, gitanaUser, function(err, platform, appHelper, key) {

            if (err) {
                return callback(err);
            }

            callback(err, gitanaUser, platform, appHelper, key, platform.getDriver());
        });
    });

};

var impersonate = exports.impersonate = function(req, key, targetUser, callback)
{
    // 1. grant "impersonator" role against targetUser for appuser
    // 2. impersonate, get the info
    // 3. revoke "impersonator" role against targetUser

    var authInfo = req.gitana.getDriver().getAuthInfo();
    var currentUserId = authInfo.principalDomainId + "/" + authInfo.principalId;

    var grantImpersonator = function(done)
    {
        Chain(targetUser).trap(function(e) {
            done();
            return false;
        }).grantAuthority(currentUserId, "impersonator").then(function () {
            done();
        });
    };

    var revokeImpersonator = function(done)
    {
        Chain(targetUser).trap(function(e) {
            done();
            return false;
        }).revokeAuthority(currentUserId, "impersonator").then(function () {
            done();
        });
    };

    var connectImpersonator = function(done)
    {
        var headers = {};
        headers["Authorization"] = req.gitana.platform().getDriver().getHttpHeaders()["Authorization"];

        var agent = http.globalAgent;
        if (process.env.GITANA_PROXY_SCHEME === "https") {
            agent = https.globalAgent;
        }

        var baseURL = util.asURL(process.env.GITANA_PROXY_SCHEME, process.env.GITANA_PROXY_HOST, process.env.GITANA_PROXY_PORT);

        request({
            "method": "POST",
            "url": baseURL + "/auth/impersonate/" + targetUser.getDomainId() + "/" + targetUser.getId(),
            "qs": {},
            "json": {},
            "headers": headers,
            "agent": agent,
            "timeout": process.defaultHttpTimeoutMs
        }, function(err, response, json) {

            // connect as the impersonated user
            var x = {
                "clientKey": req.gitanaConfig.clientKey,
                "clientSecret": req.gitanaConfig.clientSecret,
                "ticket": json.ticket,
                "baseURL": req.gitanaConfig.baseURL,
                "key": key
            };
            if (req.gitanaConfig.application) {
                x.application = req.gitanaConfig.application;
                x.appCacheKey = key;
            }
            Gitana.connect(x, function (err) {

                if (err)
                {
                    console.log("Failed to connect to Cloud CMS: " + JSON.stringify(err));
                    return done(err);
                }

                var platform = this;
                var appHelper = null;
                if (x.application) {
                    appHelper = this;
                    platform = this.platform();
                }

                done(null, platform, appHelper, key);
            });
        });
    };

    grantImpersonator(function(err) {

        if (err) {
            return revokeImpersonator(function() {
                callback(err);
            });
        }

        connectImpersonator(function(err, platform, appHelper, key) {

            if (err) {
                return revokeImpersonator(function() {
                    callback(err);
                });
            }

            revokeImpersonator(function(err) {

                if (err) {
                    return callback(err);
                }

                callback(null, platform, appHelper, key);
            });
        });
    });
};

var readTrustedProfile = exports.readTrustedProfile = function(identifier)
{
    return TRUSTED_PROFILE_CACHE.get(identifier);
};

var writeTrustedProfile = exports.writeTrustedProfile = function(identifier, profile)
{
    TRUSTED_PROFILE_CACHE.set(identifier, profile);
};
