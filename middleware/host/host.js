var path = require("path");
var util = require("../../util/util");

/**
 * Sets req.domainHost onto request.
 * Sets req.virtualHost onto request.
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

    /**
     * Resolves the virtual host.
     *
     * If CLOUDCMS_VIRTUAL_HOST or CLOUDCMS_VIRTUAL_HOST_DOMAIN are set, there's a chance we find a virtual host match.
     *
     * If we do, then virtualHost is determined and handed back.
     * If we do not, then virtualHost will be null.
     *
     * @param req
     * @param done
     */
    var resolveVirtualHost = function(req, done)
    {
        var virtualHost = null;

        // hard code to specific domain?
        if (process.env.CLOUDCMS_VIRTUAL_HOST)
        {
            virtualHost = process.env.CLOUDCMS_VIRTUAL_HOST;
        }
        else
        {
            // support for host mapping
            // this makes it easy for customers to set up a CDN with a custom header to identify the tenant
            // i.e. x-cloudcms-tenant-host = mytenant.cloudcms.net
            var forceVirtualHost = req.header("x-cloudcms-tenant-host");
            if (forceVirtualHost)
            {
                virtualHost = forceVirtualHost;
            }
            else
            {
                // CUSTOM HOST HEADER
                var customHost = null;
                if (process.configuration && process.configuration.host && process.configuration.host.hostHeader)
                {
                    customHost = req.header[process.configuration.host.hostHeader];
                }
                if (customHost)
                {
                    virtualHost = customHost;
                }
                else
                {
                    // see if we can find a header that matches our virtual hosting pattern (*.somehost.com)
                    var virtualHostDomain = process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN;
                    if (virtualHostDomain)
                    {
                        // collect all of the candidates
                        var candidates = [];

                        // origin
                        var origin = req.header("origin");
                        if (origin)
                        {
                            push(candidates, origin);
                        }

                        // X-FORWARDED-HOST
                        if (req.header("x-forwarded-host"))
                        {
                            var xForwardedHost = req.header("x-forwarded-host");
                            push(candidates, xForwardedHost);
                        }

                        // REQ.HOSTNAME
                        push(candidates, req.hostname);

                        // find the one that is a match for our virtual host domain wildcard (*.somecompany.com)
                        for (var x = 0; x < candidates.length; x++)
                        {
                            // keep only those that are subdomains of our intended parent virtualHostDomain (i.e. "cloudcms.net")
                            if (candidates[x].toLowerCase().indexOf(virtualHostDomain) > -1)
                            {
                                virtualHost = candidates[x];
                                break;
                            }
                        }

                        // if none, take first one that is not an IP address
                        if (!virtualHost)
                        {
                            if (candidates.length > 0)
                            {
                                for (var i = 0; i < candidates.length; i++)
                                {
                                    if (!util.isIPAddress(candidates[i]))
                                    {
                                        virtualHost = candidates[i];
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        done(null, virtualHost);
    };

    var resolveDomainHost = function(req, virtualHost, done)
    {
        var domainHost = null;

        // if we have a virtual host...
        if (virtualHost)
        {
            if (process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN)
            {
                // assume the browser domain matches virtual host domain
                domainHost = virtualHost;
            }
            else
            {
                // figure out the browser domain

                // collect all of the candidates
                var candidates = [];

                // origin
                var origin = req.header("origin");
                if (origin)
                {
                    push(candidates, origin);
                }

                // X-FORWARDED-HOST
                if (req.header("x-forwarded-host"))
                {
                    push(candidates, req.header("x-forwarded-host"));
                }

                // REQ.HOSTNAME
                push(candidates, req.hostname);

                // take the first one that isn't an IP address
                for (var i = 0; i < candidates.length; i++)
                {
                    if (!util.isIPAddress(candidates[i]))
                    {
                        domainHost = candidates[i];
                        break;
                    }
                }
            }
        }

        if (!domainHost)
        {
            domainHost = req.hostname;
        }

        done(null, domainHost);
    };

    var cleanupHost = function(host)
    {
        if (host)
        {
            // strip out port if it's somehow on host
            if (host.indexOf(":") > -1)
            {
                host = host.substring(0, host.indexOf(":"));
            }

            // strip out cdr from first "/" if it's somehow on host
            if (host.indexOf("/") > -1)
            {
                host = host.substring(host.indexOf("/"));
            }
        }

        return host;
    };

    var r = {};

    /**
     * @return {Function}
     */
    r.hostInterceptor = function() {

        return function (req, res, next) {

            // virtualHost is used to identify the tenant.  It might be what's in the browser or might be
            // hard-coded via CLOUDCMS_VIRTUAL_HOST
            resolveVirtualHost(req, function (err, virtualHost) {

                if (virtualHost)
                {
                    virtualHost = cleanupHost(virtualHost);
                }

                // domainHost should be what is in the browser URL.  It is used to write cookies.
                resolveDomainHost(req, virtualHost, function (err, domainHost) {

                    if (domainHost)
                    {
                        domainHost = cleanupHost(domainHost);
                    }

                    req.domainHost = domainHost;
                    req.virtualHost = virtualHost;

                    // debug
                    for (var k in req.headers) {
                        console.log("Header: " + k + " = " + req.headers[k]);
                    }
                    console.log("Conclude - domainHost: " + req.domainHost + ", virtualHost: " + req.virtualHost);

                    return next();
                });
            });
        };
    };

    return r;
}();
