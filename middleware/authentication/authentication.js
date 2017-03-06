var auth = require("../../util/auth");
var util = require("../../util/util");

var Gitana = require("gitana");

/**
 * Authentication middleware.
 *
 * @type {*}
 */
exports = module.exports = function()
{
    var PROVIDERS = {};
    var ADAPTERS = {};


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    var registerProvider = r.registerProvider = function(providerType, providerFactoryFn)
    {
        PROVIDERS[providerType] = providerFactoryFn;
    };

    var registerAdapter = r.registerAdapter = function(adapterType, adapterFactory)
    {
        ADAPTERS[adapterType] = adapterFactory;
    };

    var buildProvider = r.buildProvider = function(req, providerId, callback)
    {
        req.configuration("auth", function(err, configuration) {

            var providerDescriptor = configuration.providers[providerId];
            if (!providerDescriptor)
            {
                console.log("Cannot find provider descriptor for provider id: " + providerId);
                return callback();
            }

            if (!providerDescriptor.type)
            {
                console.log("Provider descriptor for provider: " + providerId + " does not have a type");
                return callback();
            }

            if (!providerDescriptor.config) {
                providerDescriptor.config = {};
            }

            var providerType = providerDescriptor.type;
            var providerConfig = providerDescriptor.config;

            cleanupProviderConfiguration(providerId, providerConfig);

            var providerFactory = PROVIDERS[providerType];
            var provider = providerFactory(providerId, providerType, providerConfig);


            callback(null, provider, providerType, providerConfig);
        });
    };

    var cleanupProviderConfiguration = function(providerId, providerConfig)
    {
        if (!providerConfig.callbackURL)
        {
            // calculate this
            var callbackURL = providerConfig.callbackUrl || providerConfig.callback || providerConfig.callbackURL;
            if (!callbackURL) {
                providerConfig.callbackURL = "/auth/" + providerId + "/callback";
            }
        }
    };

    var buildAdapter = r.buildAdapter = function(req, adapterId, callback)
    {
        req.configuration("auth", function(err, configuration) {

            var adapterDescriptor = configuration.adapters[adapterId];
            if (!adapterDescriptor)
            {
                console.log("Cannot find adapter descriptor for provider id: " + adapterId);
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

            var adapterFactory = ADAPTERS[adapterType];
            var adapter = adapterFactory(adapterId, adapterType, adapterConfig);

            callback(null, adapter, adapterType, adapterConfig);
        });
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
        // providers
        registerProvider("cas", require("./providers/cas"));
        registerProvider("facebook", require("./providers/facebook"));
        registerProvider("github", require("./providers/github"));
        registerProvider("google", require("./providers/google"));
        registerProvider("keycloak", require("./providers/keycloak"));
        registerProvider("linkedin", require("./providers/linkedin"));
        registerProvider("twitter", require("./providers/twitter"));

        // filter - request adapters
        registerAdapter("default", require("./adapters/default"));
        registerAdapter("jwt", require("./adapters/jwt"));

        // create handler
        return util.createHandler("authentication", "auth", function(req, res, next, stores, cache, configuration) {

            // set "passTicket" true for all providers
            if (process.env.CLOUDCMS_AUTH_PASS_TICKET === "true")
            {
                for (var providerId in configuration.providers)
                {
                    if (!configuration.providers[providerId].config) {
                        configuration.providers[providerId].config = {};
                    }
                    configuration.providers[providerId].config.passTicket = true;
                }
            }

            // set "passToken" true for all providers
            if (process.env.CLOUDCMS_AUTH_PASS_TOKEN === "true")
            {
                for (var providerId in configuration.providers)
                {
                    if (!configuration.providers[providerId].config) {
                        configuration.providers[providerId].config = {};
                    }
                    configuration.providers[providerId].config.passToken = true;
                }
            }


            var handled = false;

            // HANDLE
            if (req.method.toLowerCase() === "get")
            {
                var i = req.path.indexOf("/auth/");
                if (i > -1)
                {
                    var providerId = req.path.substring(i + 6);

                    var j = providerId.indexOf("/");
                    if (j > -1)
                    {
                        providerId = providerId.substring(0, j);
                    }

                    buildProvider(req, providerId, function(err, provider, providerType, providerConfig) {

                        if (err) {
                            return next(err);
                        }

                        if (!provider) {
                            return next();
                        }

                        if (req.path.indexOf("/callback") > -1)
                        {
                            handled = true;

                            var handleFailure = function(res, providerConfig) {
                                if (providerConfig.failureRedirect) {
                                    return res.redirect(providerConfig.failureRedirect);
                                }

                                res.status(401).end();
                            };

                            var cb = function (providerId, provider, providerConfig) {
                                return function (err, profile, info) {

                                    if (err) {
                                        console.log(err);
                                        return handleFailure(res, providerConfig);
                                    }

                                    if (!profile || !info)
                                    {
                                        return handleFailure(res, providerConfig);
                                    }

                                    var domain = req.gitana.datastore("principals");

                                    auth.syncProfile(req, res, domain, providerId, provider, profile, info.token, info.refreshToken, function(err, gitanaUser, platform, appHelper, key, driver) {

                                        if (err) {
                                            return handleFailure(res, providerConfig);
                                        }

                                        if (!gitanaUser)
                                        {
                                            if (providerConfig.registrationRedirect)
                                            {
                                                var parsedProfile = provider.parseProfile(profile);
                                                var profileIdentifier = provider.profileIdentifier(profile);

                                                var redirectUrl = providerConfig.registrationRedirect;

                                                if (!req.session)
                                                {
                                                    console.log("Registration redirect requires session");
                                                }
                                                else
                                                {
                                                    req.session.registration_user_object = parsedProfile;
                                                    req.session.registration_provider_id = providerId;
                                                    req.session.registration_user_identifier = profileIdentifier;
                                                    req.session.registration_token = info.token;
                                                    req.session.registration_refresh_token = info.refresh_token;

                                                    return res.redirect(redirectUrl);
                                                }
                                            }

                                            return handleFailure(res, providerConfig);
                                        }

                                        // redirect
                                        var url = providerConfig.successRedirect;

                                        if (providerConfig.passTicket || providerConfig.passTokens)
                                        {
                                            var accessToken = driver.getAuthInfo()["accessToken"];
                                            var refreshToken = driver.getAuthInfo()["refreshToken"];
                                            var ticket = driver.getAuthInfo().getTicket();

                                            var params = [];
                                            if (providerConfig.passTicket)
                                            {
                                                params.push("ticket=" + encodeURIComponent(ticket));
                                            }
                                            if (providerConfig.passTokens)
                                            {
                                                params.push("accessToken=" + encodeURIComponent(accessToken));

                                                if (refreshToken) {
                                                    params.push("refreshToken=" + encodeURIComponent(refreshToken));
                                                }
                                            }

                                            url = url + "?" + params.join("&");
                                        }

                                        res.redirect(url);

                                    });
                                }
                            }(providerId, provider, providerConfig);

                            provider.handleAuthCallback(req, res, next, cb);
                        }
                        else
                        {
                            handled = true;

                            provider.handleAuth(req, res, next);
                        }

                    });
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
     * Binds in an auth filter.
     *
     * @param id
     * @returns {Function}
     */
    r.auth = function(id, loginFn) {

        if (!loginFn) {
            loginFn = function(req, res, next) {
                req.user = req.gitana_user;
                next();
            };
        }

        var fn = build_auth_filter(id);
        return function(req, res, next) {

            fn(req, res, function(result) {

                var properties = req.provider_properties;
                delete req.provider_properties;

                if (!result)
                {
                    return loginFn(req, res, function(err) {
                        next(err);
                    });
                }

                // otherwise, something went wrong

                // load the configuration for the "auth" service
                req.configuration("auth", function(err, configuration) {

                    // some correction
                    if (!result.err && result.message) {
                        result.err = {
                            "message": result.message
                        };
                    }

                    var failureRedirect = null;
                    var registrationRedirect = null;

                    if (configuration && configuration.filters && configuration.filters[id])
                    {
                        var providerId = configuration.filters[id].provider;

                        failureRedirect = configuration.providers[providerId].config.failureRedirect;
                        registrationRedirect = configuration.providers[providerId].config.registrationRedirect;
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
                            req.session.registration_user_object = properties.parsed_profile;
                            req.session.registration_provider_id = properties.provider_id;
                            req.session.registration_user_identifier = properties.profile_identifier;
                            req.session.registration_token = properties.token;
                            req.session.registration_refresh_token = properties.refresh_token;

                            return res.redirect(registrationRedirect);
                        }
                    }

                    // otherwise, we're in a failure state
                    // should we redirect?
                    if (failureRedirect)
                    {
                        return res.redirect(failureRedirect);
                    }

                    // if nothing else, 401
                    res.status(401).end();
                });
            });
        }
    };

    var build_auth_filter = function(id)
    {
        return function (req, res, next) {

            req.configuration("auth", function(err, configuration) {

                if (!configuration.filters) {
                    return next({
                        "skip": true,
                        "message": "Cannot find filter configuration: " + id
                    });
                }

                var filterConfig = configuration.filters[id];
                if (!filterConfig)
                {
                    return next({
                        "skip": true,
                        "message": "Cannot find filter configuration: " + id
                    });
                }


                ///
                /// FILTER - REQUEST ADAPTER
                ///

                var adapterId = filterConfig.adapter;
                if (!adapterId)
                {
                    return next({
                        "skip": true,
                        "message": "Filter configuration: " + id + " must define an adapter"
                    });
                }

                // build adapter
                buildAdapter(req, adapterId, function (err, adapter, adapterType, adapterConfig) {

                    if (err) {
                        return next({
                            "fail": true,
                            "err": err
                        });
                    }

                    if (!adapter) {
                        return next({
                            "skip": true,
                            "message": "Cannot build adapter: " + adapterId
                        });
                    }

                    // parse the token from the request
                    var properties = adapter.parse(req);
                    if (!properties)
                    {
                        // if we were not able to extract anything, then simply bail
                        return next({
                            "skip": true,
                            "message": "Could not extract an auth token identifier from request"
                        });
                    }

                    ///
                    /// PROVIDER DESCRIPTOR
                    ///

                    var providerId = filterConfig.provider;
                    if (!providerId)
                    {
                        return next({
                            "skip": true,
                            "message": "Filter configuration: " + id + " must define a provider"
                        });
                    }

                    // build provider
                    buildProvider(req, providerId, function (err, provider, providerType, providerConfig) {

                        if (err)
                        {
                            return next({
                                "fail": true,
                                "err": err
                            });
                        }

                        if (!provider)
                        {
                            return next({
                                "skip": true,
                                "message": "Cannot build provider: " + providerId
                            });
                        }

                        // properties looks like this:
                        //
                        //     value                        the raw string collected from HTTP
                        //     trusted                      whether this identifier can be trusted and verification is not needed
                        //
                        // optional:
                        //
                        //     profile                      the user profile extracted from identifier
                        //     profile_identifier           the user profile ID (corresponds to providerUserId)
                        //     token                        access token
                        //     refresh_token                refresh token

                        // store provider ID
                        properties.provider_id = providerId;


                        var phaseProvider = function (req, provider, properties, done) {
                            // if not trusted, we first verify then load if verified
                            // this is to block against spoofed headers that are not implicitly trusted or whose trust cannot
                            // be asserted using encryption (or which the developer simply deems to be trusted due to firewall
                            // boundaries or other guarantees ahead of us in the request chain)

                            if (!properties.trusted)
                            {
                                provider.verify(properties.value, function (err, verified) {

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
                                            "message": "Unable to verify user for token: " + properties.value
                                        });
                                    }

                                    provider.load(properties.value, function (err, profile, token, refreshToken) {

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
                                                "message": "Could not load profile for identifier: " + properties.value
                                            });
                                        }

                                        properties.profile = profile;
                                        properties.profile_identifier = provider.profileIdentifier(profile);
                                        properties.token = token;
                                        properties.refresh_token = refreshToken;
                                        properties.trusted = true;
                                        properties.parsed_profile = provider.parseProfile(profile);

                                        done();
                                    });
                                });
                            }
                            else
                            {
                                provider.load(properties.value, function (err, profile, token, refreshToken) {

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
                                            "message": "Could not load profile for identifier: " + properties.value
                                        });
                                    }

                                    properties.profile = profile;
                                    properties.profile_identifier = provider.profileIdentifier(profile);
                                    properties.token = token;
                                    properties.refresh_token = refreshToken;
                                    properties.trusted = true;
                                    properties.parsed_profile = provider.parseProfile(profile);

                                    done();
                                });
                            }
                        };

                        var phaseCloudCMS = function (req, provider, properties, done) {
                            var domain = req.gitana.datastore("principals");

                            var profile = properties.profile;
                            var token = properties.token;
                            var refreshToken = properties.refreshToken;

                            auth.syncProfile(req, res, domain, providerId, provider, profile, token, refreshToken, function (err, gitanaUser, platform, appHelper, key) {

                                if (err)
                                {
                                    return done({
                                        "fail": true,
                                        "err": err
                                    });
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

                        var syncPropertiesToReq = function (req, properties) {
                            req.provider_properties = {};
                            for (var k in properties)
                            {
                                req.provider_properties[k] = properties[k];
                            }

                            if (req.provider_properties.gitana_user_connection)
                            {
                                req.gitana_user_connection = req.provider_properties.gitana_user_connection;
                                req.gitana_user = req.provider_properties.gitana_user;
                            }
                        };


                        // if the result is trusted AND we have a profile, then we can skip verifying and loading the
                        // profile from the provider

                        if (properties.trusted && properties.profile)
                        {
                            syncPropertiesToReq(req, properties);

                            return phaseCloudCMS(req, provider, properties, function (result) {

                                if (result)
                                {
                                    return next(result);
                                }

                                syncPropertiesToReq(req, properties);

                                next();
                            });
                        }

                        phaseProvider(req, provider, properties, function (result) {

                            if (result)
                            {
                                return next(result);
                            }

                            // must be trusted at this point and have a profile
                            if (!properties.trusted || !properties.profile)
                            {
                                return next({
                                    "skip": true,
                                    "message": "A trusted profile could not be obtained from provider"
                                });
                            }

                            syncPropertiesToReq(req, properties);

                            phaseCloudCMS(req, provider, properties, function (result) {

                                if (result)
                                {
                                    return next(result);
                                }

                                syncPropertiesToReq(req, properties);

                                next();
                            });
                        });
                    });
                });
            });
        };
    };

    return r;

}();
