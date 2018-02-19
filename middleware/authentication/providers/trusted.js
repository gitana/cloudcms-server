var auth = require("../../../util/auth");
var AbstractProvider = require("./abstract");

/**
 * A simple "trusted" authentication provider that assumes 100% of everything it needs is in the extracted
 * "properties" from the SSO token.
 *
 * @return {Function}
 */
class TrustedProvider extends AbstractProvider
{
    constructor(req, config)
    {
        super(req, config);
    }
}

module.exports = TrustedProvider;
