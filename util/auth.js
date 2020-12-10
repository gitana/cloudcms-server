var path = require('path');
var fs = require('fs');
var os = require('os');
var _util = require("util");
var util = require("./util");
var http = require("http");
var https = require("https");
var async = require("async");
var LRUCache = require("lru-cache");

var request = require("./request");

// trusted profile cache size 100
var TRUSTED_PROFILE_CACHE = new LRUCache({
    max:100,
    maxAge: 1000 * 60 * 15 // 15 minutes
});

// user entry cache size 100
var USER_ENTRY_CACHE = new LRUCache({
    max: 100,
    maxAge: 1000 * 60 * 15 // 15 minutes
});

var Gitana = require("gitana");
if (!Gitana.APPS) {
    Gitana.APPS = {};
}

var authFilterLoggerEnabled = (process.env.CLOUDCMS_AUTH_FILTER_LOGGER_ENABLED === "true");

exports = module.exports;

// additional methods for Gitana driver
var Gitana = require("gitana");

var buildPassportCallback = exports.buildPassportCallback = function(providerConfig, provider)
{
    return function(req, token, refreshToken, profile, done)
    {
        var info = {};

        info.providerId = providerConfig.id;
        info.providerUserId = provider.userIdentifier(profile);
        info.token = token;
        info.refreshToken = refreshToken;

        if (!info.providerUserId)
        {
            return done({
                "message": "Unable to determine provider user ID from profile"
            });
        }

        done(null, profile, info);
    };
};

var syncAttachment = exports.syncAttachment = function(gitanaUser, attachmentId, url, callback)
{
    var baseURL = gitanaUser.getDriver().getOriginalConfiguration().baseURL;
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

var logEvent = function(event, success, protocol, source, userId, ip, matchedGroup, userGroups, mandatoryGroups, accessGranted)
{
    if (!authFilterLoggerEnabled)
    {
        return;
    }

    console.log(_util.format('%s|%s|%o|%s|%s|%s|%s|%s|%s|%s|%s|%s',
        event||"Authorization",
        event||"Authorization",
        new Date(),
        protocol||"https",
        success ? "Success" : "Failed",
        userId || "NA",
        ip || "NA",
        matchedGroup || "",
        (userGroups || ["NA"]).join(','),
        (mandatoryGroups || ["NA"]).join(','),
        accessGranted || "NA",
        os.hostname()
    ));
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
            done(e);
            return false;
        }).grantAuthority(currentUserId, "impersonator").then(function () {
            done();
        });
    };

    var revokeImpersonator = function(done)
    {
        Chain(targetUser).trap(function(e) {
            done(e);
            return false;
        }).revokeAuthority(currentUserId, "impersonator").then(function () {
            done();
        });
    };

    var connectImpersonator = function(done)
    {
        var headers = {};
        headers["Authorization"] = req.gitana.platform().getDriver().getHttpHeaders()["Authorization"];

        request({
            "method": "POST",
            "url": req.gitanaConfig.baseURL + "/auth/impersonate/" + targetUser.getDomainId() + "/" + targetUser.getId(),
            "qs": {},
            "json": {},
            "headers": headers,
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

var removeTrustedProfile = exports.removeTrustedProfile = function(identifier)
{
    TRUSTED_PROFILE_CACHE.del(identifier);
};

var readUserCacheEntry = exports.readUserCacheEntry = function(identifier)
{
    return USER_ENTRY_CACHE.get(identifier);
};

var writeUserCacheEntry = exports.writeUserCacheEntry = function(identifier, entry)
{
    USER_ENTRY_CACHE.set(identifier, entry);
};

var removeUserCacheEntry = exports.removeUserCacheEntry = function(identifier)
{
    USER_ENTRY_CACHE.del(identifier);
};


var syncProfile = exports.syncProfile = function(req, res, strategy, domainId, providerId, provider, profile, token, refreshToken, callback)
{
    return provider.parseProfile(req, profile, function(err, userObject, groupsArray, mandatoryGroupsArray) {

        // special handling for mandatory groups
        if (mandatoryGroupsArray && mandatoryGroupsArray.length > 0)
        {
            // clean up white space
            for (var i = 0; i < mandatoryGroupsArray.length; i++)
            {
                mandatoryGroupsArray[i] = mandatoryGroupsArray[i].trim();
            }

            // make sure our groups Array contains at least one mandatory group
            var hasMandatoryGroup = false;
            var mandatoryGroupsMap = {};
            var matchedGroup = null;
            for (var i = 0; i < mandatoryGroupsArray.length; i++) {
                mandatoryGroupsMap[mandatoryGroupsArray[i]] = true;
            }
            for (var i = 0; i < groupsArray.length; i++) {
                if (mandatoryGroupsMap[groupsArray[i]]) {
                    matchedGroup = groupsArray[i];
                    hasMandatoryGroup = true;
                }
            }
            if (!hasMandatoryGroup)
            {
                logEvent("Authorization", false, req.protocol, providerId, profile.nameID, req.ip, null, groupsArray, mandatoryGroupsArray, null);
                return callback({
                    "message": "The incoming user does not belong to one of the mandatory groups",
                    "noMandatoryGroup": true
                });
            }

            logEvent("Authorization", true, req.protocol, providerId, profile.nameID, req.ip, matchedGroup, groupsArray, mandatoryGroupsArray, "AddToDomain:" + domainId);
        }
        else
        {
            logEvent("Authorization", true, req.protocol, providerId, profile.nameID, req.ip, null, groupsArray, null, "AddToDomain:" + domainId);
        }

        req.application(function(err, application) {

            // load settings off request
            req.applicationSettings(function(err, settings) {

                if (err || !settings) {
                    settings = {};
                }

                var providerUserId = provider.userIdentifier(profile);
                if (!providerUserId)
                {
                    return callback({
                        "message": "Unable to determine provider user ID from profile"
                    });
                }

                var key = token;

                // load sync'd users from cache
                var CACHE_IDENTIFIER = providerId + "/" + providerUserId;

                var entry = readUserCacheEntry(CACHE_IDENTIFIER);
                if (entry)
                {
                    var gitanaUser = entry.gitanaUser;
                    var platform = entry.platform;
                    var appHelper = entry.appHelper;
                    var key = entry.key;

                    if (gitanaUser && platform && key)
                    {
                        // successful cache hit
                        return callback(null, gitanaUser, platform, appHelper, key, platform.getDriver());
                    }
                    else
                    {
                        // clean up cache
                        removeUserCacheEntry(CACHE_IDENTIFIER);
                    }
                }

                _LOCK([CACHE_IDENTIFIER], function(releaseLockFn) {
                    _handleSyncUser(req, strategy, settings, key, domainId, providerId, providerUserId, token, refreshToken, userObject, groupsArray, function (err, gitanaUser) {

                        if (err) {
                            releaseLockFn();
                            return callback(err);
                        }

                        // no user found
                        if (!gitanaUser) {
                            releaseLockFn();
                            return callback();
                        }

                        _handleConnectAsUser(req, key, gitanaUser, function (err, platform, appHelper, key) {

                            if (err) {
                                releaseLockFn();
                                return callback(err);
                            }

                            // write to cache
                            writeUserCacheEntry(CACHE_IDENTIFIER, {
                                "gitanaUser": gitanaUser,
                                "platform": platform,
                                "appHelper": appHelper,
                                "key": key
                            });

                            releaseLockFn();

                            callback(err, gitanaUser, platform, appHelper, key, platform.getDriver());
                        }, gitanaUser);
                    });
                });
            });
        });
    });
};

var _handleConnectAsUser = function(req, key, gitanaUser, callback) {

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

var _handleSyncUser = function(req, strategy, settings, key, domainId, providerId, providerUserId, token, refreshToken, userObject, groupsArray, callback) {

    __handleSyncUser(req, strategy, settings, key, domainId, providerId, providerUserId, token, refreshToken, userObject, function(err, gitanaUser, synced) {

        if (err) {
            return callback(err);
        }

        if (!gitanaUser)
        {
            if (!strategy.autoRegister)
            {
                console.log("Sync user did not find a user for providerUserId: " + providerUserId + " but autoRegister is turned off, cannot auto-create the user");

                return callback({
                    "message": "User not found (autoRegister is disabled, cannot auto-create)",
                    "noAutoRegister": true
                });
            }

            console.log("Sync user did not produce a user object");

            return callback({
                "message": "User not found"
            });
        }

        if (!synced)
        {
            if (!groupsArray || groupsArray.length == 0)
            {
                return callback(null, gitanaUser);
            }
        }

        // sync groups
        __handleSyncGroups(req, strategy, settings, gitanaUser, groupsArray, function(err, gitanaUser) {

            return callback(null, gitanaUser);

        });
    });

};

var __handleSyncUser = function(req, strategy, settings, key, domainId, providerId, providerUserId, token, refreshToken, userObject, callback) {

    var baseURL = req.gitanaConfig.baseURL;
    var authorizationHeader = req.gitana.getDriver().getHttpHeaders()["Authorization"];
    var targetUrl = baseURL + "/domains/" + domainId + "/connections/sync";

    // add "authorization" for OAuth2 bearer token
    var headers = {};
    headers["Authorization"] = authorizationHeader;

    if (!userObject) {
        userObject = {};
    }

    var connectionObject = {};
    connectionObject.accessToken = token;
    connectionObject.refreshToken = refreshToken;

    var json = {
        "user": userObject,
        "connection": connectionObject
    };

    var autoCreate = strategy.autoRegister ? true : false;

    var requestConfig = {
        "method": "POST",
        "url": targetUrl,
        "qs": {
            "providerId": providerId,
            "providerUserId": providerUserId,
            "autoCreate": autoCreate
        },
        "json": json,
        "headers": headers,
        "timeout": process.defaultHttpTimeoutMs
    };

    request(requestConfig, function(err, response, json) {

        if (err) {
            return callback(err);
        }

        if (json.error === "invalid_token")
        {
            // retry after getting new token
            return req.gitana.getDriver().reloadAuthInfo(function () {
                __handleSyncUser(req, strategy, settings, key, domainId, providerId, providerUserId, token, refreshToken, userObject, function(err, gitanaUser, synced) {
                    callback(err, gitanaUser, synced);
                })
            });
        }
        else if (json.error)
        {
            if (json.message)
            {
                return callback({
                    "message": "An error occurred during user sync: " + json.message
                });
            }

            return callback({
                "message": "An error occurred during user sync: " + JSON.stringify(json)
            });
        }

        if (!json.user) {
            console.log("Did not see json.user, JSON is: " + JSON.stringify(json, null, 2));
            return callback({
                "message": "An error occurred during user sync - the response did not contain an error but also did not provide json.user"
            });
        }

        var userId = json.user._doc;
        var domainId = json.user.domainId;
        var synced = json.user.synced;

        // read the user back
        var platform = null;
        if (req.gitana.readDomain) {
            platform = req.gitana;
        } else {
            platform = req.gitana.platform();
        }

        Chain(platform).readDomain(domainId).readPrincipal(userId).then(function() {
            callback(null, this, synced);
        });

    });
};

var executeRule = function(req, rule, gitanaUser, callback)
{
    //
    // addToProject(projectId)
    // addToProject(projectId, [teamKey]);
    //
    // removeFromProject(projectId);
    //
    // addToPlatformTeam([teamKey])
    // removeFromPlatformTeam([teamKey])

    var ensureArray = function(teamIdentifiers) {
        var array = [];
        if (!teamIdentifiers) {
            return array;
        }

        if (typeof(teamIdentifiers) === "string") {
            array.push(teamIdentifiers);
        }

        for (var i = 0; i < teamIdentifiers.length; i++) {
            array.push(teamIdentifiers[i]);
        }

        return array;
    };

    var addToProject = function(projectId, teamIdentifiers, finished) {

        if (!teamIdentifiers) {
            teamIdentifiers = "project-users-team";
        }

        teamIdentifiers = ensureArray(teamIdentifiers);

        var project = null;
        var stack = null;

        return req.gitana.platform().trap(function(e) {
            return false;
        }).readProject(projectId).then(function(){
            project = this;
        }).readStack().then(function() {
            stack = this;

            var fns = [];
            for (var i = 0; i < teamIdentifiers.length; i++)
            {
                var fn = function(stack, teamIdentifier, user) {
                    return function(d) {

                        console.log("Working on stack: " + stack._doc + ", team: " + teamIdentifier + ", user: " + user._doc);

                        Chain(stack).trap(function(e) {
                            d();
                            return false;
                        }).readTeam(teamIdentifier).then(function() {
                            var team = this;

                            Chain(team).hasMember(user, function(has) {
                                if (has) {
                                    return d();
                                }
                                Chain(team).addMember(user).then(function() {
                                    d();
                                });
                            });
                        });

                    }
                }(stack, teamIdentifiers[i], gitanaUser);
                fns.push(fn);
            }
            async.series(fns, function() {
                finished();
            });
        });
    };

    var addToPlatformTeams = function(teamIdentifiers, finished) {

        if (!teamIdentifiers) {
            teamIdentifiers = "project-users-team";
        }

        teamIdentifiers = ensureArray(teamIdentifiers);

        var platform = null;

        return Chain(req.gitana.platform()).trap(function(e) {
            return false;
        }).then(function() {
            platform = this;

            var fns = [];
            for (var i = 0; i < teamIdentifiers.length; i++)
            {
                var fn = function(platform, teamIdentifier, user) {
                    return function(d) {

                        console.log("Working on platform team: " + teamIdentifier + ", user: " + user._doc);

                        Chain(platform).trap(function(e) {
                            d();
                            return false;
                        }).readTeam(teamIdentifier).then(function() {
                            var team = this;

                            Chain(team).hasMember(user, function(has) {
                                if (has) {
                                    return d();
                                }
                                Chain(team).addMember(user).then(function() {
                                    d();
                                });
                            });
                        });

                    }
                }(platform, teamIdentifiers[i], gitanaUser);
                fns.push(fn);
            }
            async.series(fns, function() {
                finished();
            });
        });
    };

    const {VM} = require("vm2");
    var vm = new VM({
        timeout: 5000,
        sandbox: {
            "addToProject": function(projectId, teamIdentifiers) {
                return addToProject(projectId, teamIdentifiers, function() {
                    console.log("Added user: " + gitanaUser._doc + " to project: " + projectId + ", teams: " + JSON.stringify(teamIdentifiers));
                });
            },
            "addToPlatformTeam": function(teamIdentifier) {
                return addToPlatformTeams([teamIdentifier], function() {
                    console.log("Added user: " + gitanaUser._doc + " to platform team: " + teamIdentifier);
                });
            },
            "addToPlatformTeams": function(teamIdentifiers) {
                return addToPlatformTeams(teamIdentifiers, function() {
                    console.log("Added user: " + gitanaUser._doc + " to platform teams: " + JSON.stringify(teamIdentifiers));
                });
            }
        }
    });
    vm.run(rule);

    setTimeout(function() {
        callback();
    }, 250);
};

var __handleSyncGroups = function(req, strategy, settings, gitanaUser, groupsArray, callback) {

    if (!groupsArray || groupsArray.length === 0)
    {
        return callback(null, gitanaUser);
    }

    // if no groupMappings defined, bail
    if (!settings || !settings.sso || !settings.sso.groupMappings || settings.sso.groupMappings.length === 0) {
        return callback(null, gitanaUser);
    }

    // copy mappings into a lookup list
    var groupRules = {};
    for (var i = 0; i < settings.sso.groupMappings.length; i++)
    {
        groupRules[settings.sso.groupMappings[i].key] = settings.sso.groupMappings[i].values;
    }

    var fns = [];
    for (var i = 0; i < groupsArray.length; i++)
    {
        var groupIdentifier = groupsArray[i];

        var rules = groupRules[groupIdentifier];
        if (rules)
        {
            for (var x = 0; x < rules.length; x++)
            {
                var fn = function (rule, gitanaUser) {
                    return function (done) {
                        executeRule(req, rule, gitanaUser, function (err) {
                            done(err);
                        });
                    }
                }(rules[x], gitanaUser);
                fns.push(fn);
            }
        }
    }

    async.series(fns, function() {
        callback(null, gitanaUser);
    });
};
