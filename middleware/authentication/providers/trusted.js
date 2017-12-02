var auth = require("../../../util/auth");
var extend = require("extend-with-super");

/**
 * A simple "trusted" authentication provider that assumes 100% of everything it needs is in the extracted
 * "properties" from the SSO token.
 *
 * @return {Function}
 */
exports = module.exports = function(PROVIDER_ID, PROVIDER_TYPE, config)
{
    var base = require("./abstract")(PROVIDER_ID, PROVIDER_TYPE, config);

    //////

    var r = {};

    return extend(base, r);
};

