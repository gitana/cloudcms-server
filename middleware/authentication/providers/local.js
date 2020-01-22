const jsonwebtoken = require("jsonwebtoken");

var AbstractProvider = require("./abstract");

class LocalProvider extends AbstractProvider
{
    constructor(req, config)
    {
        if (!config.loginUrl) {
            config.loginUrl = "/login";
        }

        if (!config.authcodeName) {
            config.authcodeName = process.env.AUTHCODE_NAME || "authcode";
        }

        if (!config.authcodeSecret) {
            config.authcodeSecret = process.env.AUTHCODE_SECRET || "authcodeSecret";
        }

        if (!config.authcodeIssuer) {
            config.authcodeIssuer = process.env.AUTHCODE_ISSUER || "authcodeIssuer";
        }

        if (!config.properties) {
            config.properties = {};
        }

        if (!config.properties.id) {
            config.properties.id = "unique_name";
        }

        super(req, config);
    }

    // handles /auth/custom
    handleAuth(req, res, next)
    {
        res.redirect(this.config.loginUrl);
    }

    // handles /auth/custom/callback
    handleAuthCallback(req, res, next, callback)
    {
        var authcode = req.query[this.config.authcodeName];

        if (!authcode)
        {
            return callback( {
                "message": "Authcode not found"
            });
        }

        var authObject = null;
        try
        {
            var options = {};
            options.issuer = this.config.authcodeIssuer;

            authObject = jsonwebtoken.verify(authcode, this.config.authcodeSecret, options);
        }
        catch (e)
        {
            console.log(e);
            return callback({
                "message": "Failed to parse authcode token"
            });
        }

        var profile = authObject.profile;
        var info = authObject.info || {};

        callback(null, profile, info);
    }

    /*
    userIdentifier(profile)
    {
        return profile.unique_name;
    }
    */

    /*
    parseProfile(req, profile, callback)
    {
        var userObject = {};
        userObject.name = profile.unique_name;
        userObject.firstName = profile.given_name;
        userObject.lastName = profile.family_name;
        userObject.email = profile.email;

        var groupsArray = [];

        var mandatoryGroupsArray = [];

        callback(null, userObject, groupsArray, mandatoryGroupsArray);
    }
    */

    // handles trusted JWT token load
    load(properties, callback)
    {
        // {"unique_name":"demo","preferred_username":"demo","given_name":"Joe","family_name":"Smith","email":"joesmith@test.com","provider_id":"local1"}
        console.log("PROPERTIES: " + JSON.stringify(properties));

        if (!properties || !properties.token){
            callback("Cannot find token in properties");
        }

        var profile = {};
        profile.name = "asdasd";
        profile.firstName = "first";
        profile.lastName = "last";
        profile.email = "email";

        callback(null, profile);
    }
}

module.exports = LocalProvider;