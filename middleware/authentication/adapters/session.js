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
            if (req.session._auth_profile)
            {
                var properties = {
                    "token": req.session._auth_profile.unique_name,
                    "trusted": true,
                    "profile": req.session._auth_profile
                };
    
                return callback(null, properties);
            }
        }
        
        return super.identify(req, callback);
    }    
}

module.exports = SessionAdapter;