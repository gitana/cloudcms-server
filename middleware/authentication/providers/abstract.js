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
    };

    /**
     * Given the authentication adapter's profile, fires the callback with the extracted user object (JSON) and the
     * extracted token and refresh token.
     *
     * @param profile
     */
    r.parseProfile = function(profile)
    {
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
    };

    return r;
};

