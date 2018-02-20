class AbstractProvider
{
    constructor(req, config)
    {
        this.config = config;

        if (!config.properties) {
            config.properties = {};
        }

        if (!config.properties.id) {
            config.properties.id = "id";
        }
    }

    /**
     * Given the user profile acquired from the authenticaiton provider, extract the
     * user identifier (which serves as the providerUserId).
     *
     * @param profile
     */
    userIdentifier(profile)
    {
        return profile[this.config.properties.id];
    }

    /**
     * Handles the request when a call is made to "/auth/<providerId>".
     *
     * This method is responsible for redirecting the user to the authentication provider's login page.
     *
     * @param req
     * @param res
     * @param next
     */
    handleAuth(req, res, next)
    {
        // by default, we throw an error
        throw new Error("This authentication provider does not support handleAuth()");
    }

    /**
     * Handles the request when the authentication provider's login process completes and the user is redirected back
     * to the server with a code - to the URL "/auth/<providerId>/callback".
     *
     * @param req
     * @param res
     * @param next
     * @param callback
     */
    handleAuthCallback(req, res, next, callback)
    {
        // by default, we throw an error
        throw new Error("This authentication provider does not support handleAuthCallback()");
    }

    /**
     * Given the auth profile, fires the callback with the extracted user object (JSON) and the
     * extracted token and refresh token.
     *
     * A default implementation is supported here.
     * A few core properties are supported.
     *
     * @param req
     * @param profile
     */
    parseProfile(req, profile, callback)
    {
        var userObject = {};
        var groupsArray = [];

        if (!profile) {
            return callback(null, userObject, groupsArray);
        }

        var userProperties = this.config.userProperties;
        if (!userProperties)
        {
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

        // NOTE: no handling of groupsArray

        callback(null, userObject, groupsArray);
    }

    /**
     * Given the auth profile, loads avatar icon information and stores it onto the given
     * Gitana User object.
     *
     * @param gitanaUser
     * @param profile
     * @param callback
     */
    syncAvatar(gitanaUser, profile, callback)
    {
        // by default, don't do anything
        // extend this to pull down an image and attach to the user account
        // see twitter provider for example

        callback();
    }

    /**
     * Verifies that what we know about a user from their request attributes describes an authenticated user
     * against the authentication provider.
     *
     * @param properties
     * @param callback (err, valid)
     */
    verify(properties, callback)
    {
        this.load(properties, function(err, profile) {

            if (err) {
                return callback(err);
            }

            callback(null, true, profile);
        });
    }

    /**
     * Loads a user profile from the authentication provider given what we know about them from
     * the identity properties.
     *
     * @param properties
     * @param callback (err, profile)
     */
    load(properties, callback)
    {
        // by default, we throw an error
        throw new Error("This authentication provider does not support load()");
    }
}

module.exports = AbstractProvider;