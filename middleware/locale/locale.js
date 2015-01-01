var path = require('path');
var util = require('../../util/util');

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
