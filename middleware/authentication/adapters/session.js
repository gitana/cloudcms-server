var AbstractAdapter = require("./abstract");

class SessionAdapter extends AbstractAdapter
{
    constructor(req, config)
    {
        super(req, config);
    }

    identify(req, callback)
    {
        if (req.session)
        {
            return req.session.reload(function() {
    
                if (req.session._auth_profile)
                {
                    var properties = {
                        "token": req.session._auth_profile.unique_name,
                        "trusted": true,
                        "profile": req.session._auth_profile
                    };
        
                    return callback(null, properties);
                }
                else
                {
                    return super.identify(req, callback);
                }
            });
        }
        
        return super.identify(req, callback);
    }    
}

module.exports = SessionAdapter;