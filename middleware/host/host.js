var path = require('path');
var util = require('../../util/util');

/**
 * Sets host onto request.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var push = function(candidates, text)
    {
        if (text)
        {
            var z = text.indexOf(",");
            if (z > -1)
            {
                var array = text.split(",");
                for (var i = 0; i < array.length; i++)
                {
                    candidates.push(util.trim(array[i]));
                }
            }
            else
            {
                candidates.push(text);
            }
        }
    };

    var r = {};

    /**
     * @return {Function}
     */
    r.hostInterceptor = function() {

        return function(req, res, next) {

            var domain = process.env.CLOUDCMS_DOMAIN;

            // collect all of the candidates
            var candidates = [];

            // X-FORWARDED-HOST
            var xForwardedHost = null;
            if (req.header("X-Forwarded-Host")) {
                xForwardedHost = req.header("X-Forwarded-Host");
            }
            else if (req.header("x-forwarded-host")) {
                xForwardedHost = req.header("x-forwarded-host");
            }
            else if (req.header("X-FORWARDED-HOST")) {
                xForwardedHost = req.header("X-FORWARDED-HOST");
            }
            push(candidates, xForwardedHost);

            // CUSTOM HOST HEADER
            if (process.configuration && process.configuration.host) {
                if (process.configuration.host.hostHeader) {
                    var customHost = req.header[process.configuration.host.hostHeader];
                    push(candidates, customHost);
                }
            }

            // REQ.HOSTNAME
            push(candidates, req.hostname);

            // find the one that is for our domain
            var host = null;
            for (var x = 0; x < candidates.length; x++) {
                // keep only those that are subdomains of our intended parent domain (i.e. "cloudcms.net")
                if (candidates[x].toLowerCase().indexOf(domain) > -1) {
                    host = candidates[x];
                    break;
                }
            }
            //console.log("Resolved host: " + host);

            // if none, take first one that is not an IP address
            if (!host) {
                if (candidates.length > 0) {
                    for (var i = 0; i < candidates.length; i++) {
                        if (!util.isIPAddress(candidates[i])) {
                            host = candidates[i];
                            break;
                        }
                    }
                }
            }

            req.domainHost = host;

            next();
        };
    };

    return r;
}();
