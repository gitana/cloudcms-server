class AbstractAuthenticator
{
    constructor(req, config)
    {
        this.req = req;
        this.config = config || {};
    }

    /**
     * Authenticates the user to the application (logs in).
     *
     * @param req
     * @param res
     * @param gitanaUser
     * @param callback
     */
    login(req, res, gitanaUser, callback)
    {
        callback();
    }

    /**
     * Unauthenticates the user from the application (logs out).
     *
     * @param req
     * @param res
     * @param callback
     */
    logout(req, res, callback)
    {
        callback();
    }

    /**
     * Determines whether the current request is already authenticated for the given set of identifying properties.
     *
     * This is called during an SSO filter's execution to determine whether the SSO identifier information should be
     * used to authenticate the user.  If the user is already authenticated, the process is skipped.
     *
     * @param req
     * @param properties
     */
    isAuthenticated(req, properties)
    {
        return false;
    }
}

module.exports = AbstractAuthenticator;