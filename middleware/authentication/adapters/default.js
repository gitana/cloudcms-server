/**
 * Default adapter.
 *
 *
 * parse()
 *
 *   The parse method should have back the following properties at a minimum:
 *
 *     token                - the string that comprises the identity of the user (usually the header or token value)
 *     trusted              - whether the identifier must be challenged for authenticity (if false, challenge)
 *
 *   And the following is optional:
 *
 *     profile              - the extracted user profile
 *     user_identifier   - the ID of the extracted user profile (usually from a field within the profile)
 *
 * @type {*}
 */
module.exports = function(adapterId, adapterType, config)
{
    var r = {};

    r.parse = function(req)
    {
        var value = null;
        if (config.header) {
            value = req.headers[config.header.toLowerCase()];
        }
        else if (config.cookie) {
            value = req.cookies[config.cookie.toLowerCase()];
        }

        if (!value) {
            return null;
        }

        var properties = {};
        properties.token = value;
        properties.trusted = config.trusted ? true: false;

        return properties;
    };

    return r;
};