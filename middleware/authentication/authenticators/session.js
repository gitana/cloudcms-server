var DefaultAuthenticator = require("./default");

class SessionAuthenticator extends DefaultAuthenticator
{
    constructor(req, config)
    {
        super(req, config)
    }

    /** @override **/
    login(req, res, gitanaUser, callback)
    {
        if (req.user) {
            return callback();
        }

        var profile = req.auth_callback_profile;
        if (profile)
        {
            req.session._auth_profile = profile;
        }

        // log in using express
        return req.logIn(gitanaUser, function() {

            req.user = gitanaUser;

            if (req.session)
            {
                return req.session.save(function() {
                    callback();
                });
            }

            callback();
        });
    }

    /** @override **/
    logout(req, res, callback)
    {
        req.logout();        
        req.session.destroy();

        callback();
    }
}

module.exports = SessionAuthenticator;