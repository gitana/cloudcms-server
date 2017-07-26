var exports = module.exports;

exports.DEFAULT_GITANA_PROXY_SCHEME = "https";
exports.DEFAULT_GITANA_PROXY_HOST = "api1.cloudcms.com";
exports.DEFAULT_GITANA_PROXY_PORT = 443;

/**
 * This version of the cloudcms-server supports CloudFront CDN.  Anybody using "api.cloudcms.com" can auto-upgrade
 * to "api1.cloudcms.com" for the time being as this points to CloudFront.
 *
 * In the future, we'll migrate "api.cloudcms.com" to CloudFront and this will no longer be necessary.
 *
 * @param host
 * @returns {*}
 */
exports.autoUpgrade = function(hostOrUrl, verbose)
{
    // default value if not supplied
    if (typeof(process.env.CLOUDCMS_API_PREFER_CDN) === "undefined") {
        process.env.CLOUDCMS_API_PREFER_CDN = "true";
        process.env.CLOUDCMS_API_PREFER_LB = "false";
    }

    if (hostOrUrl)
    {
        var handleReplaceHost = function(hostOrUrl, oldHost, newHost, verbose, loggerFn)
        {
            if (hostOrUrl.indexOf(oldHost) > -1)
            {
                if (verbose)
                {
                    loggerFn(oldHost, newHost);
                }

                hostOrUrl = hostOrUrl.replace(oldHost, newHost);
            }

            return hostOrUrl;
        };

        if (process.env.CLOUDCMS_API_PREFER_CDN === true || process.env.CLOUDCMS_API_PREFER_CDN === "true")
        {
            hostOrUrl = handleReplaceHost(hostOrUrl, "api.cloudcms.com", "api1.cloudcms.com", verbose, function(oldHost, newHost) {
                console.log("Adjusting API connection to use CloudFront: " + oldHost + " to: " + newHost + " for improved edge performance");
            });
        }
        else if (process.env.CLOUDCMS_API_PREFER_LB === true || process.env.CLOUDCMS_API_PREFER_LB === "true")
        {
            hostOrUrl = handleReplaceHost(hostOrUrl, "api1.cloudcms.com", "api.cloudcms.com", verbose, function(oldHost, newHost) {
                console.log("Adjusting API connection to use Load Balancer: " + oldHost + " to: " + newHost);
            });

        }
    }

    return hostOrUrl;
};