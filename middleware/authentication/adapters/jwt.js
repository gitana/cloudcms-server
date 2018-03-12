var AbstractAdapter = require("./abstract");
var jwt = require("jsonwebtoken");

class JWTAdapter extends AbstractAdapter
{
    constructor(req, config)
    {
        super(req, config);
    }

    identify(req, callback)
    {
        var self = this;

        // call into base method to extract from raw request
        super.identify(req, function(err, properties) {

            if (err) {
                return callback(err);
            }

            if (!properties) {
                return callback();
            }

            // the extract JWT token
            var token = properties.token;

            // if we have a secret configured, then we can "trust" the token
            var object = null;
            if (self.config.secret)
            {
                var options = {};
                if (self.config.algorithm) {
                    options.algorithm = [config.algorithm];
                }
                if (self.config.issuer) {
                    options.issuer = config.issuer;
                }

                object = jwt.verify(token, self.config.secret, options);
                properties.trusted = true;
            }
            else
            {
                object = jwt.decode(token);
            }

            // allow for the profile field to be picked off the object
            // otherwise, we simply pass the entire JWT object forward
            var profileField = self.config.profile_field;
            if (!profileField) {
                profileField = "profile";
            }
            var profile = null;
            if (object[profileField]) {
                profile = object[profileField];
            }
            if (!profile) {
                profile = object;
            }

            // store profile
            if (profile)
            {
                properties.profile = profile;

                // pick off user id
                var user_identifier_field = self.config.field;
                if (!user_identifier_field)
                {
                    user_identifier_field = "preferred_username";
                }

                var user_identifier = profile[user_identifier_field];

                // if not found, try "unique_name"
                if (!user_identifier) {

                    user_identifier = profile["unique_name"];
                }

                if (user_identifier)
                {
                    properties.user_identifier = user_identifier;
                }
            }

            callback(null, properties);
        });
    }
}

/**
 * JWT adapter.
 *
 * @type {*}
 */
module.exports = JWTAdapter;
