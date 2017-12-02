/**
 * Abstract implementation of a provider.
 *
 * @type {Function}
 */
exports = module.exports = function(providerId, providerType, config)
{
    if (!config.properties) {
        config.properties = {};
    }

    if (!config.properties.id) {
        config.properties.id = "id";
    }

    var r = {};

    /**
     * @returns {string} the provider ID
     */
    r.providerId = function()
    {
        return providerId;
    };

    /**
     * @returns {string} the provider Type
     */
    r.providerType = function()
    {
        return providerType;
    };

    /**
     * @returns {object} the provider configuration
     */
    r.providerConfiguration = function()
    {
        return config;
    };

    /**
     * Given the user profile acquired from the authenticaiton provider, extract the
     * user identifier (which serves as the providerUserId).
     *
     * @param profile
     */
    r.userIdentifier = function(profile)
    {
        return profile[config.properties.id];
    };

    /**
     * Handles the request when a call is made to "/auth/<providerId>".
     *
     * This method is responsible for redirecting the user to the authentication provider's login page.
     *
     * @param req
     * @param res
     * @param next
     */
    r.handleAuth = function(req, res, next)
    {
        // by default, we throw an error
        throw new Error("This authentication provider does not support handleAuth()");
    };

    /**
     * Handles the request when the authentication provider's login process completes and the user is redirected back
     * to the server with a code - to the URL "/auth/<providerId>/callback".
     *
     * @param req
     * @param res
     * @param next
     * @param callback
     */
    r.handleAuthCallback = function(req, res, next, callback)
    {
        // by default, we throw an error
        throw new Error("This authentication provider does not support handleAuthCallback()");
    };

    /**
     * Given the authentication adapter's profile, fires the callback with the extracted user object (JSON) and the
     * extracted token and refresh token.
     *
     * A default implementation is supported here.
     * A few core properties are supported.
     *
     * @param profile
     */
    r.parseProfile = function(profile)
    {
        var userObject = {};

        if (!profile) {
            return userObject;
        }

        var userProperties = config.userProperties;
        if (!userProperties) {
            userProperties = {};
            userProperties["firstName"] = "given_name";
            userProperties["lastName"] = "family_name";
            userProperties["email"] = "email";
        }

        for (var userProperty in userProperties)
        {
            if (!userObject[userProperty])
            {
                var profileProperty = userProperties[userProperty];
                if (profileProperty)
                {
                    if (profile[profileProperty])
                    {
                        userObject[userProperty] = profile[profileProperty];
                    }
                }
            }
        }

        return userObject;
    };

    /**
     * Given the authentication adapter's profile, loads avatar icon information and stores it onto the given
     * Gitana User object.
     *
     * @param gitanaUser
     * @param profile
     * @param callback
     */
    r.syncAvatar = function(gitanaUser, profile, callback)
    {
        // by default, don't do anything
        // extend this to pull down an image and attach to the user account
        // see twitter provider for example

        callback();
    };

    /**
     * Verifies that what we know about a user from their request attribuets describes an authenticated user
     * against the authentication provider.
     *
     * @param properties
     * @param callback (err, valid)
     */
    r.verify = function(properties, callback)
    {
        this.load(properties, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, true, profile);
        });
    };

    /**
     * Loads a user profile from the authentication provider given what we know about them from the adapter.
     *
     * @param properties
     * @param callback (err, profile)
     */
    r.load = function(properties, callback)
    {
        // by default, we throw an error
        throw new Error("This authentication provider does not support load()");
    };

    return r;
};

