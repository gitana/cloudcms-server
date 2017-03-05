var jwt = require("jsonwebtoken");

/**
 * JWT adapter.
 *
 * @type {*}
 */
module.exports = function(adapterId, adapterType, config)
{
    var r = {};

    r.parse = function(req) {

        var value = null;
        if (config.header)
        {
            value = req.headers[config.header];
        }
        else if (config.cookie)
        {
            value = req.cookies[config.cookie];
        }

        if (!value)
        {
            return null;
        }

        // unpack the jwt

        var trusted = false;

        var object = null;
        if (config.secret)
        {
            object = jwt.verify(value, config.secret);
            trusted = true;
        }
        else
        {
            object = jwt.decode(value);
        }

        // TODO: how do we get the "profile"
        var profile = object;

        // pick off user id
        var userIdField = config.field;
        if (!userIdField)
        {
            userIdField = "preferred_username";
        }

        var result = {};

        result.value = value;
        result.trusted = trusted;

        // extra things
        result.token = null;
        result.refresh_token = null;

        result.profile = profile;
        result.profile_identifier = profile[userIdField];

        // allow for config override
        if (typeof(config.trusted) !== "undefined")
        {
            result.trusted = config.trust;
        }

        return result;
    };

    return r;
};