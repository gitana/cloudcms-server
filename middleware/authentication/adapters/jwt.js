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

        // TODO: the profile is assumed to be contained inside of the payload object
        var profileField = config.profile_field;
        if (!profileField) {
            profileField = "profile";
        }

        var profile = object[profileField];

        // pick off user id
        var user_identifier_field = config.field;
        if (!user_identifier_field)
        {
            user_identifier_field = "preferred_username";
        }

        var user_identifier = object[user_identifier_field];

        var properties = {};

        // required
        properties.token = value;
        properties.trusted = trusted;

        if (profile) {
            properties.profile = profile;
        }

        if (user_identifier) {
            properties.user_identifier = user_identifier;
        }

        return properties;
    };

    return r;
};