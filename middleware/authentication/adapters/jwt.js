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
            value = req.headers[config.header.toLowerCase()];
        }
        else if (config.cookie)
        {
            value = req.cookies[config.cookie.toLowerCase()];
        }

        if (!value)
        {
            return null;
        }

        // unpack the jwt

        var trusted = config.trusted ? true : false;

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
        result.token = value;
        result.refresh_token = null;

        result.profile = profile;
        result.profile_identifier = profile[userIdField];

        result.trusted = trusted;

        return result;
    };

    return r;
};