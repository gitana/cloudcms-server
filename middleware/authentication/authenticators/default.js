var AbstractAuthenticator = require("./abstract");

class DefaultAuthenticator extends AbstractAuthenticator
{
    constructor(req, config)
    {
        super(req, config)
    }

    /** @override **/
    login(req, res, gitanaUser, callback)
    {
        // support for express/passport
        if (!req.user && req.logIn)
        {
            return req.logIn(gitanaUser, function() {

                if (req.session)
                {
                    return req.session.save(function() {
                        callback();
                    });
                }

                callback();
            });
        }

        // otherwise, just store onto request
        req.user = gitanaUser;

        callback();
    }

    /** @override **/
    logout(req, res, callback)
    {
        // support for express/passport
        if (req.user && req.logout) {
            req.logout();
            return callback();
        }

        // otherwise, just remove user
        delete req.user;

        callback();
    }

    /** @override **/
    isAuthenticated(req, properties)
    {
        // support for express/passport
        if (req.isAuthenticated) {
            return req.isAuthenticated();
        }

        // if req.user...?
        if (req.user) {
            return true;
        }

        return false;
    }
}

module.exports = DefaultAuthenticator;