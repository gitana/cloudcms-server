var path = require('path');
var util = require('../../util/util');
var accepts = require('accepts');

/**
 * Sets locale.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var r = {};

    /**
     * @return {Function}
     */
    r.localeInterceptor = function()
    {
        return function(req, res, next)
        {
            var acceptLanguage = "en-us"

            if(accepts(req) && accepts(req).languages() && accepts(req).languages()[0]) {
                acceptLanguage = accepts(req).languages()[0];
            }

            req.acceptLanguage = acceptLanguage;

            var locale = "default";

            if (req.locale) {
                locale = req.locale;
            }

            if (req.query && req.query.locale) {
                locale = req.query.locale;
            }

            req.locale = locale;

            next();
        };
    };

    return r;
}();
