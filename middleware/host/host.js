var path = require("path");
var util = require("../../util/util");
//var dns = require("dns");

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

    /*
    var cnameCache = {};
    var CNAME_EXPIRATION_TIME_MS = 1000 * 60 * 5; // five minutes

    var resolveCNameAddress = function(req, hostname, callback)
    {
        var now = new Date().getTime();

        var entry = cnameCache[hostname];
        if (entry)
        {
            if (entry.expiration < now) {
                delete cnameCache[hostname];
                entry = null;
            }
            else if (entry.address === "NULL")
            {
                // support for null sentinel
                return callback();
            }
            else
            {
                return callback(null, entry.address);
            }
        }

        _resolveCNameAddress(req, hostname, function(err, address) {

            // mark null sentinel if not found
            if (err || !address) {
                address = "NULL";
            }

            cnameCache[hostname] = {
                "address": address,
                "expiration": now + CNAME_EXPIRATION_TIME_MS
            };

            return callback(null, address);
        });
    };

    var _resolveCNameAddress = function(req, hostname, callback)
    {
        dns.resolveCname(hostname, function(err, addresses) {

            if (err) {
                return callback(err);
            }

            var address = null;
            if (addresses && addresses.length > 0) {
                address = addresses[0];
            }

            callback(null, address);
        });
    };
    */

    var r = {};

    /**
     * @return {Function}
     */
    r.hostInterceptor = function() {

        return function(req, res, next) {

            /*
            // easy way to locally invalidate the cname cache
            if (req.query.invalidate) {
                delete cnameCache[req.hostname];
            }
            */

            var handleCompletion = function(req, res, next, _virtualHost)
            {
                // base case
                req.domainHost = req.hostname;
                req.virtualHost = process.env.CLOUDCMS_STANDALONE_HOST;

                // strip out port if it's somehow on host
                if (_virtualHost && _virtualHost.indexOf(":") > -1)
                {
                    _virtualHost = _virtualHost.substring(0, _virtualHost.indexOf(":"));
                }

                // strip out cdr from first "/" if it's somehow on host
                if (_virtualHost && _virtualHost.indexOf("/") > -1)
                {
                    _virtualHost = _virtualHost.substring(_virtualHost.indexOf("/"));
                }

                // virtual mode
                if (_virtualHost)
                {
                    req.virtualHost = _virtualHost;
                }

                /*
                for (var k in req.headers) {
                    console.log("Header: " + k + " = " + req.headers[k]);
                }
                console.log("Conclude - domainHost: " + req.domainHost + ", virtualHost: " + req.virtualHost);
                */

                // virtualHost is the host that we manage on disk
                // multiple real-world hosts might map into the same virtual host
                // for example, "abc.cloudcms.net and "def.cloudcms.net" could connect to Cloud CMS as a different tenant
                // process.env.CLOUDCMS_STANDALONE_HOST means that gitana.json is provided manually, no virtualized connections

                return next();
            };

            var _virtualHost = process.env.CLOUDCMS_VIRTUAL_HOST;
            if (!_virtualHost)
            {
                // support for host mapping
                // this makes it easy for customers to set up a CDN with a custom header to identify the tenant
                // i.e. x-cloudcms-tenant-host = mytenant.cloudcms.net
                var forceVirtualHost = req.header("x-cloudcms-tenant-host");
                if (forceVirtualHost)
                {
                    _virtualHost = forceVirtualHost;
                }
            }

            if (_virtualHost)
            {
                return handleCompletion(req, res, next, _virtualHost);
            }

            // we couldn't pick something off so we have to figure it out based on the slew of headers we're provided

            // assume hostname
            _virtualHost = req.hostname;

            // see if we can process for a virtual host domain
            var virtualHostDomain = process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN;
            if (virtualHostDomain)
            {
                // collect all of the candidates
                var candidates = [];

                // X-FORWARDED-HOST
                if (req.header("x-forwarded-host"))
                {
                    var xForwardedHost = req.header("x-forwarded-host");
                    push(candidates, xForwardedHost);
                }

                // CUSTOM HOST HEADER
                if (process.configuration && process.configuration.host)
                {
                    if (process.configuration.host.hostHeader)
                    {
                        var customHost = req.header[process.configuration.host.hostHeader];
                        push(candidates, customHost);
                    }
                }

                // REQ.HOSTNAME
                push(candidates, req.hostname);

                // find the one that is for our virtualHostDomain
                for (var x = 0; x < candidates.length; x++)
                {
                    // keep only those that are subdomains of our intended parent virtualHostDomain (i.e. "cloudcms.net")
                    if (candidates[x].toLowerCase().indexOf(virtualHostDomain) > -1)
                    {
                        _virtualHost = candidates[x];
                        break;
                    }
                }

                // if none, take first one that is not an IP address
                if (!_virtualHost)
                {
                    if (candidates.length > 0)
                    {
                        for (var i = 0; i < candidates.length; i++)
                        {
                            if (!util.isIPAddress(candidates[i]))
                            {
                                _virtualHost = candidates[i];
                                break;
                            }
                        }
                    }
                }
            }

            /*
            // check if there is a cname entry for this host
            resolveCNameAddress(req, _virtualHost, function(err, address) {

                if (address) {
                    console.log("Resolved host: " + _virtualHost + " to address: " + address);
                    _virtualHost = address;
                }

                handleCompletion(req, res, next, _virtualHost);
            });
            */

            handleCompletion(req, res, next, _virtualHost);

        };
    };

    return r;
}();
