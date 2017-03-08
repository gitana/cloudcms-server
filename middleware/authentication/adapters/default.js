/**
 * Default adapter.
 *
 *
 * parse()
 *
 *   The parse method should have back the following at a minimum:
 *
 *     identifier           - the string that comprises the identity of the user (usually the header or token value)
 *     trusted              - whether the identifier must be challenged for authenticity (if false, challenge)
 *
 *   And the following is optional:
 *
 *     profile              - the extracted user profile
 *     profile_identifier   - the ID of the extracted user profile (usually from a field within the profile)
 *
 *
 * apply()
 *
 *   Adds the SSO token to the response (usually as a cookie).
 *
 *
 * unapply()
 *
 *   Removes the SSO token from the response (usually as a cookie).
 *
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

        var result = {};
        result.value = value;
        result.trusted = config.trusted ? true: false;

        return result;
    };

    return r;
};