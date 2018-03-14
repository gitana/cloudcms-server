var auth = require("../../util/auth");
var util = require("../../util/util");

var Gitana = require("gitana");
var async = require("async");

/**
 * Authentication middleware.
 *
 * @type {*}
 */
exports = module.exports = function()
{
    // request token adapters
    var ADAPTERS = {};

    // external identity providers
    var PROVIDERS = {};

    // authentication handlers
    var AUTHENTICATORS = {};


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    var registerAdapter = r.registerAdapter = function(adapterType, adapterFactory)
    {
        ADAPTERS[adapterType] = adapterFactory;

        return adapterFactory;
    };

    var registerProvider = r.registerProvider = function(providerType, providerFactory)
    {
        PROVIDERS[providerType] = providerFactory;

        return providerFactory;
    };

    var registerAuthenticator = r.registerAuthenticator = function(authenticatorType, authenticatorFactory)
    {
        AUTHENTICATORS[authenticatorType] = authenticatorFactory;

        return authenticatorFactory;
    };

    var buildStrategies = r.buildStrategies = function(req, callback)
    {
        req.configuration("auth", function(err, configuration) {

            if (!configuration.strategies)
            {
                return callback({
                    "message": "Authentication missing strategies block"
                });
            }

            var strategyResults = {};

            var fns = [];
            for (var strategyId in configuration.strategies)
            {
                var fn = function(req, strategyId, strategyResults) {
                    return function (done) {
                        buildStrategy(req, strategyId, function (err, result) {
                            strategyResults[strategyId] = result;
                            done();
                        });
                    }
                }(req, strategyId, strategyResults);
                fns.push(fn);
            }

            async.series(fns, function() {
                callback(null, strategyResults);
            });
        });
    };

    var buildStrategy = r.buildStrategy = function(req, strategyId, callback)
    {
        req.configuration("auth", function(err, configuration) {

            if (!configuration.strategies)
            {
                return callback({
                    "message": "Authentication missing strategies block"
                });
            }

            var strategy = configuration.strategies[strategyId];
            if (!strategy)
            {
                return callback({
                    "message": "Cannot find strategy: " + strategyId
                });
            }

            var fns = [];

            var result = {};
            result.strategyId = strategyId;
            result.strategy = strategy;

            // ADAPTERS
            var adapterId = strategy.adapter;
            if (adapterId)
            {
                var adapterDescriptor = configuration.adapters[adapterId];
                if (adapterDescriptor)
                {
                    if (!adapterDescriptor.config) {
                        adapterDescriptor.config = {};
                    }

                    fns.push(function (req, adapterId, adapterDescriptor, result) {
                        return function (done) {

                            result.adapterId = adapterId;
                            result.adapterType = adapterDescriptor.type;
                            result.adapterConfig = adapterDescriptor.config;

                            _buildAdapter(req, adapterId, adapterDescriptor, function (err, adapter) {
                                result.adapter = adapter;

                                done(err);
                            });
                        }
                    }(req, adapterId, adapterDescriptor, result));
                }
            }

            // PROVIDER
            var providerId = strategy.provider;
            if (providerId)
            {
                var providerDescriptor = configuration.providers[providerId];
                if (providerDescriptor)
                {
                    if (!providerDescriptor.config) {
                        providerDescriptor.config = {};
                    }

                    fns.push(function (req, providerId, providerDescriptor, result) {
                        return function (done) {

                            result.providerId = providerId;
                            result.providerType = providerDescriptor.type;
                            result.providerConfig = providerDescriptor.config;

                            _buildProvider(req, providerId, providerDescriptor, strategyId, strategy, function (err, provider) {
                                result.provider = provider;

                                done(err);
                            });
                        }
                    }(req, providerId, providerDescriptor, result));
                }
            }

            // AUTHENTICATOR
            var authenticatorId = strategy.authenticator;
            if (authenticatorId)
            {
                var authenticatorDescriptor = configuration.authenticators[authenticatorId];
                if (authenticatorDescriptor)
                {
                    if (!authenticatorDescriptor.config) {
                        authenticatorDescriptor.config = {};
                    }

                    fns.push(function (req, authenticatorId, authenticatorDescriptor, result) {
                        return function (done) {

                            result.authenticatorId = authenticatorId;
                            result.authenticatorType = authenticatorDescriptor.type;
                            result.authenticatorConfig = authenticatorDescriptor.config;

                            _buildAuthenticator(req, authenticatorId, authenticatorDescriptor, function (err, authenticator) {
                                result.authenticator = authenticator;

                                done(err);
                            });
                        }
                    }(req, authenticatorId, authenticatorDescriptor, result));
                }
            }

            async.series(fns, function () {
                callback(null, result, result.strategyId, result.strategy, result.adapterId, result.adapter, result.providerId, result.provider, result.authenticatorId, result.authenticator);
            });
        });
    };

    var _buildAdapter = function(req, adapterId, adapterDescriptor, callback)
    {
        if (!adapterId) {
            return callback();
        }

        if (!adapterDescriptor.type)
        {
            console.log("Adapter descriptor for adapter: " + adapterId + " does not have a type");
            return callback();
        }

        if (!adapterDescriptor.config) {
            adapterDescriptor.config = {};
        }

        var adapterType = adapterDescriptor.type;
        var adapterConfig = adapterDescriptor.config;
        if (!adapterConfig.id) {
            adapterConfig.id = adapterId;
        }

        var adapterFactory = ADAPTERS[adapterType];
        var adapter = new adapterFactory(req, adapterConfig);
        adapter.id = adapterId;

        callback(null, adapter);
    };

    var _buildProvider = function(req, providerId, providerDescriptor, strategyId, strategy, callback)
    {
        if (!providerId) {
            return callback();
        }

        if (!providerDescriptor.type)
        {
            console.log("Provider descriptor for provider: " + providerId + " does not have a type");
            return callback();
        }

        if (!providerDescriptor.config)
        {
            providerDescriptor.config = {};
        }

        var providerType = providerDescriptor.type;
        var providerConfig = providerDescriptor.config;

        if (!providerConfig.callbackURL)
        {
            // calculate this
            var callbackURL = providerConfig.callbackUrl || providerConfig.callback || providerConfig.callbackURL;
            if (!callbackURL)
            {
                providerConfig.callbackURL = "/auth/" + strategyId + "/callback";
            }
        }

        if (!providerConfig.id) {
            providerConfig.id = providerId;
        }

        // build provider
        var providerFactory = PROVIDERS[providerType];
        var provider = new providerFactory(req, providerConfig);
        provider.id = providerId;

        callback(null, provider);
    };

    var _buildAuthenticator = function(req, authenticatorId, authenticatorDescriptor, callback)
    {
        if (!authenticatorId) {
            return callback();
        }

        if (!authenticatorDescriptor.type)
        {
            console.log("Authenticator descriptor for authenticator: " + authenticatorId + " does not have a type");
            return callback();
        }

        if (!authenticatorDescriptor.config) {
            authenticatorDescriptor.config = {};
        }

        var authenticatorType = authenticatorDescriptor.type;
        var authenticatorConfig = authenticatorDescriptor.config;

        if (!authenticatorConfig.id) {
            authenticatorConfig.id = authenticatorId;
        }

        var authenticatorFactory = AUTHENTICATORS[authenticatorType];
        var authenticator = new authenticatorFactory(req, authenticatorConfig);
        authenticator.id = authenticatorId;

        callback(null, authenticator);
    };

    /**
     * Handles calls to:
     *
     *     /auth/<providerId>
     *     /auth/<providerId>/*
     *
     * @return {Function}
     */
    r.handler = function(app)
    {
        // request adapters
        registerAdapter("default", require("./adapters/default"));
        registerAdapter("jwt", require("./adapters/jwt"));

        // providers
        registerProvider("cas", require("./providers/cas"));
        registerProvider("facebook", require("./providers/facebook"));
        registerProvider("github", require("./providers/github"));
        registerProvider("google", require("./providers/google"));
        registerProvider("keycloak", require("./providers/keycloak"));
        registerProvider("linkedin", require("./providers/linkedin"));
        registerProvider("saml", require("./providers/saml"));
        registerProvider("trusted", require("./providers/trusted"));
        registerProvider("twitter", require("./providers/twitter"));

        // authenticators
        registerAuthenticator("default", require("./authenticators/default"));

        // create handler
        return util.createHandler("authentication", "auth", function(req, res, next, stores, cache, configuration) {

            // set "passTicket" true for all providers
            if (process.env.CLOUDCMS_AUTH_PASS_TICKET === "true")
            {
                for (var strategyId in configuration.strategies)
                {
                    configuration.strategies[strategyId].passTicket = true;
                }
            }

            // set "passTokens" true for all providers
            if (process.env.CLOUDCMS_AUTH_PASS_TOKENS === "true")
            {
                for (var strategyId in configuration.strategies)
                {
                    configuration.strategies[strategyId].passTokens = true;
                }
            }

            var createAuthCallbackFunction = function (strategyId, strategy, providerId, provider, authenticator) {

                var handleFailure = function(err, res) {

                    if (!err) {
                        err = {
                            "message": "Unable to sync or auto-register a user on authentication callback (registrationRedirect is not specified), unable to proceed"
                        };
                    }

                    console.log("Auth Callback failed, err: " + JSON.stringify(err));

                    if (err.message)
                    {
                        if (req.flash)
                        {
                            req.flash("errorMessage", err.message);
                            req.flash("error", err);
                        }
                    }

                    // use "no account" redirect URI if provided
                    if (strategy.noAccountRedirect)
                    {
                        return res.redirect(strategy.noAccountRedirect);
                    }

                    // use "no account" handler if provided
                    if (strategy.noAccountHandler)
                    {
                        return strategy.noAccountHandler(req, res, next);
                    }

                    // otherwise just fall back to Node's handling
                    next(err);
                };

                return function (err, profile, info) {

                    if (err) {
                        return handleFailure(err, res);
                    }

                    if (!profile || !info)
                    {
                        return handleFailure(null, res);
                    }

                    var domain = req.gitana.datastore("principals");

                    auth.syncProfile(req, res, strategy, domain, providerId, provider, profile, info.token, info.refreshToken, function(err, gitanaUser, platform, appHelper, key, driver) {

                        if (!gitanaUser)
                        {
                            if (strategy.registrationRedirect)
                            {
                                return provider.parseProfile(req, profile, function(err, userObject, groupsArray) {

                                    if (err) {
                                        return handleFailure(err, res);
                                    }

                                    var userIdentifier = provider.userIdentifier(profile);

                                    var registrationRedirectUrl = strategy.registrationRedirect;

                                    if (!req.session)
                                    {
                                        return handleFailure({
                                            "message": "Registration redirect requires session"
                                        }, res);
                                    }
                                    else
                                    {
                                        req.session.registration_strategy_id = strategyId;
                                        req.session.registration_user_object = userObject;
                                        req.session.registration_user_identifier = userIdentifier;
                                        req.session.registration_groups_array = groupsArray;
                                        req.session.registration_token = info.token;
                                        req.session.registration_refresh_token = info.refresh_token;

                                        return res.redirect(registrationRedirectUrl);
                                    }
                                });
                            }
                            else if (strategy.registrationHandler)
                            {
                                return provider.parseProfile(req, profile, function(err, userObject, groupsArray) {

                                    if (err) {
                                        return handleFailure(err, res);
                                    }

                                    var userIdentifier = provider.userIdentifier(profile);

                                    strategy.registrationHandler(req, res, next, strategyId, userIdentifier, userObject, groupsArray, info);
                                });
                            }

                            return handleFailure(err, res);
                        }

                        if (err) {
                            return handleFailure(err, res);
                        }

                        var handleAfterAuthenticate = function(res, strategy, driver)
                        {
                            // redirect
                            var successRedirectUrl = strategy.successRedirect;
                            if (!successRedirectUrl)
                            {
                                successRedirectUrl = "/";
                            }

                            if (strategy.passTicket || strategy.passTokens)
                            {
                                var accessToken = driver.getAuthInfo()["accessToken"];
                                var refreshToken = driver.getAuthInfo()["refreshToken"];
                                var ticket = driver.getAuthInfo().getTicket();

                                var params = [];
                                if (strategy.passTicket)
                                {
                                    params.push("ticket=" + encodeURIComponent(ticket));
                                }
                                if (strategy.passTokens)
                                {
                                    params.push("accessToken=" + encodeURIComponent(accessToken));

                                    if (refreshToken) {
                                        params.push("refreshToken=" + encodeURIComponent(refreshToken));
                                    }
                                }

                                successRedirectUrl = successRedirectUrl + "?" + params.join("&");
                            }

                            res.redirect(successRedirectUrl);
                        };

                        // if no authenticator
                        if (!authenticator)
                        {
                            return handleAfterAuthenticate(res, strategy, driver);
                        }

                        // store some things onto the request
                        req.gitana_user = gitanaUser;
                        req.gitana_user_ticket = driver.getAuthInfo().ticket;
                        req.gitana_user_access_token = driver.getAuthInfo().accessToken;

                        // log in the user - this creates session information or persists response cookies to sign the user in
                        authenticator.login(req, res, gitanaUser, function(err) {

                            if (err) {
                                return handleFailure(err, res);
                            }

                            handleAfterAuthenticate(res, strategy, driver);
                        });
                    });
                }
            };

            var handled = false;

            // HANDLE
            if (req.method.toLowerCase() === "get")
            {
                var i = req.path.indexOf("/auth/");
                if (i > -1)
                {
                    handled = true;

                    var strategyId = req.path.substring(i + 6);
                    var j = strategyId.indexOf("/");
                    if (j > -1)
                    {
                        strategyId = strategyId.substring(0, j);
                    }

                    buildStrategy(req, strategyId, function(err, result, strategyId, strategy, adapterId, adapter, providerId, provider, authenticatorId, authenticator) {

                        if (err) {
                            return next(err);
                        }

                        // provider
                        if (!provider) {
                            return next({
                                "message": "Authentication strategy is not configured with a provider"
                            });
                        }

                        if (req.path.indexOf("/callback") > -1)
                        {
                            var cb = createAuthCallbackFunction(strategyId, strategy, providerId, provider, authenticator);

                            provider.handleAuthCallback(req, res, next, cb);
                        }
                        else if (req.path.indexOf("/logout") > -1)
                        {
                            authenticator.logout(req, res, function(err) {

                                if (err) {
                                    next(err);
                                }

                                // after logging out, where should we redirect to?
                                var redirectUri = req.query["redirectUri"];
                                if (!redirectUri) {
                                    redirectUri = req.query["redirectURI"];
                                }
                                if (!redirectUri) {
                                    redirectUri = req.query["redirect"];
                                }
                                if (!redirectUri) {
                                    redirectUri = strategy.logoutRedirect;
                                }
                                if (!redirectUri) {
                                    redirectUri = "/";
                                }

                                res.redirect(redirectUri);
                            });
                        }
                        else
                        {
                            provider.handleAuth(req, res, next);
                        }

                    });
                }
            }
            else if (req.method.toLowerCase() === "post")
            {
                var i = req.path.indexOf("/auth/");
                if (i > -1)
                {
                    if (req.path.indexOf("/callback") > -1)
                    {
                        handled = true;

                        var strategyId = req.path.substring(i + 6);

                        var j = strategyId.indexOf("/");
                        if (j > -1)
                        {
                            strategyId = strategyId.substring(0, j);
                        }

                        buildStrategy(req, strategyId, function(err, result, strategyId, strategy, adapterId, adapter, providerId, provider, authenticatorId, authenticator) {

                            if (err)
                            {
                                return next(err);
                            }

                            // provider
                            if (!provider)
                            {
                                return next({
                                    "message": "Authentication strategy is not configured with a provider"
                                });
                            }

                            var cb = createAuthCallbackFunction(strategyId, strategy, providerId, provider, authenticator);

                            provider.handleAuthCallback(req, res, next, cb);
                        });
                    }
                }
            }

            if (!handled)
            {
                next();
            }
        });
    };

    // nothing to do at the moment
    r.interceptor = function() {
        return function(req, res, next) {
            next();
        }
    };

    /**
     * Binds in authentication strategy filter.
     *
     * @param strategyId
     * @returns {Function}
     */
    r.filter = function(strategyId) {

        var fn = build_auth_filter(strategyId);
        return function(req, res, next) {

            fn(req, res, function(result, authenticator) {

                var properties = req.identity_properties;
                //delete req.identity_properties;

                if (!result)
                {
                    // no result means that we successfully authenticated
                    // the req has properties on it that we can use to login
                    if (authenticator)
                    {
                        return authenticator.login(req, res, req.gitana_user, function(err) {
                            next(err);
                        });
                    }

                    // otherwise, do something default here
                    req.user = req.gitana_user;
                    return next();
                }

                // otherwise, something went wrong
                // it could be a misconfiguration issue
                // or it could be that no properties were extracted from the adapter

                // load the configuration for the "auth" service
                req.configuration("auth", function(err, configuration) {

                    // some correction
                    if (!result.err && result.message) {
                        result.err = {
                            "message": result.message
                        };
                    }

                    if (result.err && result.err.message) {
                        req.log("Auth strategy: " + strategyId + " - filter error: " + result.err.message);
                    }

                    var providerId = null;
                    var failureRedirect = null;
                    var adapterFailureRedirect = null;
                    var adapterFailureHandler = null;
                    var registrationRedirect = null;
                    var autoLogin = null;
                    var loginRedirect = null;
                    var loginHandler = null;

                    if (configuration && configuration.strategies && configuration.strategies[strategyId])
                    {
                        var strategy = configuration.strategies[strategyId];

                        failureRedirect = strategy.failureRedirect;
                        adapterFailureRedirect = strategy.adapterFailureRedirect;
                        adapterFailureHandler = strategy.adapterFailureHandler;
                        registrationRedirect = strategy.registrationRedirect;
                        autoLogin = strategy.autoLogin;
                        loginRedirect = strategy.loginRedirect;
                        loginHandler = strategy.loginHandler;
                    }

                    // if no user, redirect to registration url?
                    if (result.nouser && registrationRedirect)
                    {
                        if (!req.session)
                        {
                            console.log("Registration redirect requires a session to be configured");
                        }
                        else
                        {
                            req.session.registration_strategy_id = strategyId;
                            req.session.registration_user_object = properties.user_object;
                            req.session.registration_user_identifier = properties.user_identifier;
                            req.session.registration_token = properties.token;
                            req.session.registration_refresh_token = properties.refresh_token;

                            return res.redirect(registrationRedirect);
                        }
                    }

                    // if we didn't extract any identifier properties
                    if (result.noProperties)
                    {
                        // should we auto login?
                        if (autoLogin)
                        {
                            // redirect to auth provider (takes us to the login form on the login server)
                            return res.redirect("/auth/" + providerId);
                        }
                        else if (loginRedirect)
                        {
                            return res.redirect(loginRedirect);
                        }
                        else if (loginHandler)
                        {
                            return loginHandler(req, res, next);
                        }
                        else if (failureRedirect)
                        {
                            return res.redirect(failureRedirect);
                        }
                        else
                        {
                            // hand back to Node Express
                            return next(result.err);
                        }
                    }

                    // if we were supposed to redirect (such as when a "loginUrl" was required for JWT), then we redirect here
                    if (result.adapterFailed)
                    {
                        // if the adapter failed, then we consider whatever token present to be invalid
                        // attempt to log out to tear down that state
                        if (authenticator) {
                            authenticator.logout(req, res, function() {
                                // logged out
                            });
                        }

                        if (adapterFailureRedirect)
                        {
                            return res.redirect(adapterFailureRedirect);
                        }

                        if (adapterFailureHandler)
                        {
                            return adapterFailureHandler(req, res, next, result.err);
                        }

                        return next(err);
                    }

                    // otherwise, we're in a failure state
                    // should we redirect?
                    if (failureRedirect)
                    {
                        return res.redirect(failureRedirect);
                    }

                    // otherwise, hand to standard node error handling
                    if (!err) {
                        err = result.err;
                    }
                    if (!err) {
                        err = {
                            "message": "Authentication filter failed"
                        };
                    }
                    next(err);
                });
            });
        }
    };

    var build_auth_filter = function(strategyId)
    {
        return function (req, res, filterDone) {

            req.configuration("auth", function(err, configuration) {

                if (!configuration.strategies) {
                    return filterDone({
                        "skip": true,
                        "message": "Authentication missing strategies block"
                    });
                }

                var strategyDescriptor = configuration.strategies[strategyId];
                if (!strategyDescriptor)
                {
                    return filterDone({
                        "skip": true,
                        "message": "Cannot find strategy: " + strategyId
                    });
                }

                // construct all the strategy components
                buildStrategy(req, strategyId, function(err, result, strategyId, strategy, adapterId, adapter, providerId, provider, authenticatorId, authenticator) {

                    // REQUIRED FOR FILTER
                    // adapter
                    if (!adapterId)
                    {
                        return filterDone({
                            "fail": true,
                            "message": "Filter for strategy configuration: " + strategyId + " must define an adapter"
                        }, authenticator);

                    }
                    if (!adapter)
                    {
                        return filterDone({
                            "fail": true,
                            "message": "Cannot build adapter: " + adapterId
                        }, authenticator);
                    }

                    // REQUIRED FOR FILTER
                    // provider
                    if (!providerId)
                    {
                        return filterDone({
                            "fail": true,
                            "message": "Strategy configuration: " + strategyId + " must define a provider"
                        }, authenticator);

                    }
                    if (!provider)
                    {
                        return filterDone({
                            "fail": true,
                            "message": "Cannot build provider: " + providerId
                        }, authenticator);
                    }

                    // OPTIONAL FOR FILTER
                    // authenticator
                    if (authenticatorId && !authenticator)
                    {
                        return filterDone({
                            "fail": true,
                            "message": "Cannot build authenticator: " + authenticatorId
                        }, authenticator);
                    }


                    //////////////////////////////////////////////////////////////////////////////////////////////////
                    //
                    // EXECUTE THE FILTER
                    //
                    //////////////////////////////////////////////////////////////////////////////////////////////////

                    // allow adapter to extract identifier properties
                    adapter.identify(req, function(err, properties, redirectForAuth, redirectUrl) {

                        if (err)
                        {
                            var evt = {
                                "fail": true,
                                "message": err.message,
                                "err": err
                            };

                            // copy forward
                            if (err.adapterFailed) {
                                evt.adapterFailed = true;
                            }

                            return filterDone(evt, authenticator);
                        }

                        if (!properties)
                        {
                            if (!redirectForAuth)
                            {
                                // if we were not able to extract anything, then simply bail
                                return filterDone({
                                    "skip": true,
                                    "noProperties": true,
                                    "message": "Adapter could not extract properties from request"
                                }, authenticator);
                            }
                            else
                            {
                                if (redirectUrl)
                                {
                                    return res.redirect(redirectUrl);
                                }

                                // redirect for auth
                                return res.redirect("/auth/" + strategyId);
                            }
                        }

                        // properties looks like this:
                        //
                        //     token                        the raw string collected from HTTP
                        //     trusted                      whether this identifier can be trusted and verification is not needed
                        //
                        // optional:
                        //
                        //     profile                      the user profile extracted from identifier
                        //     user_identifier              the user ID (corresponds to providerUserId)
                        //     refresh_token                refresh token
                        //     anything else
                        //
                        // these properties are used by the provider to sync users
                        //

                        // store provider ID on the properties
                        properties.provider_id = providerId;

                        var syncPropertiesToReq = function (req, properties)
                        {
                            req.identity_properties = {};
                            for (var k in properties)
                            {
                                req.identity_properties[k] = properties[k];
                            }

                            if (req.identity_properties.gitana_user_connection)
                            {
                                req.gitana_user_connection = req.identity_properties.gitana_user_connection;
                                req.gitana_user = req.identity_properties.gitana_user;
                                req.gitana_user_ticket = req.identity_properties.gitana_ticket;
                                req.gitana_user_access_token = req.identity_properties.gitana_access_token;

                                delete req.identity_properties.gitana_user_connection;
                                delete req.identity_properties.gitana_user;
                                delete req.identity_properties.gitana_ticket;
                                delete req.identity_properties.gitana_access_token;
                            }
                        };

                        // check whether our application already has an authenticated user for these properties
                        // if it does, we pass through
                        // if it does not, then we perform the sync phases
                        var isAuthenticated = false;
                        if (authenticator && authenticator.isAuthenticated)
                        {
                            isAuthenticated = authenticator.isAuthenticated(req, properties);
                        }

                        if (isAuthenticated)
                        {
                            // sync properties to request
                            syncPropertiesToReq(req, properties);

                            // we are already authenticated, so don't bother going any further
                            return filterDone(null, authenticator);
                        }

                        // if we get this far, we have identity properties but are NOT authenticated yet

                        var phaseProvider = function (req, provider, properties, done) {

                            // if not trusted, we first verify then load if verified
                            // this is to block against spoofed headers that are not implicitly trusted or whose trust cannot
                            // be asserted using encryption (or which the developer simply deems to be trusted due to firewall
                            // boundaries or other guarantees ahead of us in the request chain)

                            if (!properties.trusted)
                            {
                                provider.verify(properties, function (err, verified, profile) {

                                    if (err)
                                    {
                                        return done({
                                            "fail": true,
                                            "err": err
                                        });
                                    }

                                    if (!verified)
                                    {
                                        return done({
                                            "skip": true,
                                            "message": "Unable to verify user for token: " + properties.token
                                        });
                                    }

                                    // if we were able to load a profile from the verify step, then don't bother
                                    // with the call to load()
                                    if (profile)
                                    {
                                        properties.trusted = true;
                                        properties.profile = profile;

                                        if (!properties.user_identifier)
                                        {
                                            properties.user_identifier = provider.userIdentifier(profile);
                                        }

                                        return provider.parseProfile(req, profile, function(err, userObject, groupsArray) {

                                            if (err) {
                                                return done(err);
                                            }

                                            properties.user_object = userObject;
                                            properties.groups_array = groupsArray;

                                            done();
                                        });
                                    }

                                    provider.load(properties, function (err, profile) {

                                        if (err)
                                        {
                                            return done({
                                                "fail": true,
                                                "err": err
                                            });
                                        }

                                        if (!profile)
                                        {
                                            return done({
                                                "skip": true,
                                                "message": "Could not load profile for token: " + properties.token
                                            });
                                        }

                                        properties.trusted = true;
                                        properties.profile = profile;

                                        if (!properties.user_identifier)
                                        {
                                            properties.user_identifier = provider.userIdentifier(profile);
                                        }

                                        return provider.parseProfile(req, profile, function(err, userObject, groupsArray) {

                                            if (err) {
                                                return done(err);
                                            }

                                            properties.user_object = userObject;
                                            properties.groups_array = groupsArray;

                                            done();
                                        });
                                    });
                                });
                            }
                            else
                            {
                                provider.load(properties, function (err, profile) {

                                    if (err)
                                    {
                                        return done({
                                            "fail": true,
                                            "err": err
                                        });
                                    }

                                    if (!profile)
                                    {
                                        return done({
                                            "skip": true,
                                            "message": "Could not load profile for token: " + properties.token
                                        });
                                    }

                                    properties.trusted = true;
                                    properties.profile = profile;

                                    if (!properties.user_identifier)
                                    {
                                        properties.user_identifier = provider.userIdentifier(profile);
                                    }

                                    return provider.parseProfile(req, profile, function(err, userObject, groupsArray) {

                                        if (err) {
                                            return done(err);
                                        }

                                        properties.user_object = userObject;
                                        properties.groups_array = groupsArray;

                                        done();
                                    });
                                });
                            }
                        };

                        var phaseCloudCMS = function (req, strategy, provider, properties, done) {
                            var domain = req.gitana.datastore("principals");

                            var profile = properties.profile;
                            var token = properties.token;
                            var refreshToken = properties.refreshToken;

                            auth.syncProfile(req, res, strategy, domain, providerId, provider, profile, token, refreshToken, function (err, gitanaUser, platform, appHelper, key) {

                                if (err)
                                {
                                    // for err.noAutoRegister, we let it fail gracefully with !gitanaUser
                                    if (!err.noAutoRegister)
                                    {
                                        return done({
                                            "fail": true,
                                            "err": err
                                        });
                                    }
                                }

                                if (!gitanaUser)
                                {
                                    return done({
                                        "nouser": true,
                                        "err": err
                                    });
                                }

                                properties.gitana_user = gitanaUser;
                                properties.gitana_user_id = gitanaUser.getId();
                                properties.gitana_platform = platform;
                                properties.gitana_apphelper = appHelper;
                                properties.gitana_key = key;
                                properties.gitana_access_token = platform.getDriver().getAuthInfo()["accessToken"];
                                properties.gitana_refresh_token = platform.getDriver().getAuthInfo()["refreshToken"];
                                properties.gitana_ticket = platform.getDriver().getAuthInfo().getTicket();

                                if (properties.gitana_platform)
                                {
                                    properties.gitana_user_connection = properties.gitana_platform;
                                }

                                if (properties.gitana_apphelper)
                                {
                                    properties.gitana_user_connection = properties.gitana_apphelper;
                                }

                                done();
                            });
                        };

                        // if the result is NOT trusted, we can check our TRUSTED_PROFILES cache to see if we can
                        // reuse a previously trusted profile (so as to avoid going over the wire)
                        if (!properties.trusted && properties.token)
                        {
                            var trustedProfile = auth.readTrustedProfile(properties.token);
                            if (trustedProfile)
                            {
                                // console.log("reusing trusted profile for token: " + properties.token);
                                properties.trusted = true;
                                properties.profile = trustedProfile;
                            }
                        }

                        // if the result is trusted AND we have a profile, then we can skip verifying and loading the
                        // profile from the provider
                        if (properties.trusted && properties.profile)
                        {
                            syncPropertiesToReq(req, properties);

                            return phaseCloudCMS(req, strategy, provider, properties, function (result) {

                                if (result)
                                {
                                    return filterDone(result, authenticator);
                                }

                                syncPropertiesToReq(req, properties);

                                filterDone(null, authenticator);
                            });
                        }

                        // otherwise, walk through both phases

                        phaseProvider(req, provider, properties, function (result) {

                            if (result)
                            {
                                return filterDone(result);
                            }

                            // must be trusted at this point and have a profile
                            if (!properties.trusted || !properties.profile)
                            {
                                return filterDone({
                                    "skip": true,
                                    "message": "A trusted profile could not be obtained from provider"
                                }, authenticator);
                            }

                            // store onto cache
                            // console.log("writing trusted profile for token: " + properties.token);
                            auth.writeTrustedProfile(properties.token, properties.profile);

                            syncPropertiesToReq(req, properties);

                            phaseCloudCMS(req, strategy, provider, properties, function (result) {

                                if (result)
                                {
                                    return filterDone(result, authenticator);
                                }

                                syncPropertiesToReq(req, properties);

                                filterDone(null, authenticator);
                            });
                        });
                    });
                });
            });
        };
    };

    return r;

}();
