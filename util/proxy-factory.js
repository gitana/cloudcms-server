var http = require("http");
var https = require("https");
var path = require("path");

var httpProxy = require("http-proxy");

var auth = require("./auth");
var util = require("./util");

var oauth2 = require("./oauth2")();

var urlTool = require("url");

var LRUCache = require("lru-cache");

var exports = module.exports;

var _LOCK = function(lockIdentifiers, workFunction)
{
    process.locks.lock(lockIdentifiers.join("_"), workFunction);
};

var NAMED_PROXY_HANDLERS_CACHE = new LRUCache({
    max: 200,
    maxAge: 1000 * 60 * 60 // 60 minutes
});

var acquireProxyHandler = exports.acquireProxyHandler = function(proxyTarget, pathPrefix, callback)
{
    var name = path.join(proxyTarget, (pathPrefix || "/"));

    // is it already in LRU cache?
    // if so hand it back
    var _cachedHandler = NAMED_PROXY_HANDLERS_CACHE[name];
    if (_cachedHandler)
    {
        return callback(null, _cachedHandler);
    }

    // take out a thread lock
    _LOCK(["acquireProxyHandler", name], function(releaseLockFn) {

        // second check to make sure another thread didn't create the handler in the meantime
        _cachedHandler = NAMED_PROXY_HANDLERS_CACHE[name];
        if (_cachedHandler)
        {
            releaseLockFn();
            return callback(null, _cachedHandler);
        }

        // create the proxy handler and cache it into LRU cache
        _cachedHandler = createProxyHandler(proxyTarget, pathPrefix);

        // store back into LRU cache
        NAMED_PROXY_HANDLERS_CACHE[name] = _cachedHandler;

        releaseLockFn();
        callback(null, _cachedHandler);
    });
};

var createProxyHandler = function(proxyTarget, pathPrefix)
{
    ////////////////////////////////////////////////////////////////////////////
    //
    // HTTP/HTTPS Proxy Server to Cloud CMS
    // Facilitates Cross-Domain communication between Browser and Cloud Server
    // This must appear at the top of the app.js file (ahead of config) for things to work
    //
    ////////////////////////////////////////////////////////////////////////////

    // NOTE: changeOrigin must be true because of the way that we set host to host:port
    // in http-proxy's common.js line 102, the host is only properly set up if changeOrigin is set to true
    // this sets the "host" header and it has to match what is set at the network/transport level in a way
    // (inner workings of Node http request)
    //
    var proxyConfig = {
        "target": proxyTarget,
        "agent": http.globalAgent,
        "xfwd": false,
        "proxyTimeout": process.defaultHttpTimeoutMs,
        "changeOrigin": true
    };

    // use https?
    if (util.isHttps(proxyTarget))
    {
        // parse the target to get host
        var proxyHost = urlTool.parse(proxyTarget).host;

        proxyConfig = {
            "target": proxyTarget,
            "agent": https.globalAgent,
            "headers": {
                "host": proxyHost
            }
        };
    }

    // create proxy server instance
    var proxyServer = new httpProxy.createProxyServer(proxyConfig);
    
    // error handling
    proxyServer.on("error", function(err, req, res) {
        console.log("A proxy error was caught: " + err + ", json: " + JSON.stringify(err) + ", path: " + req.path);
        
        // do our best to send something back
        try
        {
            res.writeHead(500, {
                'Content-Type': 'text/plain'
            });
        }
        catch (e) { }
        
        try
        {
            res.end('Something went wrong while proxying the request.');
        }
        catch (e) { }
    });

    // if we're using auth credentials that are picked up in SSO chain, then we listen for a 401
    // and if we hear it, we automatically invalidate the SSO chain so that the next request
    // will continue to work
    proxyServer.on("proxyRes", function (proxyRes, req, res) {

        if (req.gitana_user)
        {
            var chunks = [];
            // triggers on data receive
            proxyRes.on('data', function(chunk) {
                // add received chunk to chunks array
                chunks.push(chunk);
            });

            proxyRes.on("end", function () {

                if (proxyRes.statusCode === 401)
                {
                    var text = "" + Buffer.concat(chunks);
                    if (text && (text.indexOf("invalid_token") > -1) || (text.indexOf("invalid_grant") > -1))
                    {
                        var identifier = req.identity_properties.provider_id + "/" + req.identity_properties.user_identifier;

                        _LOCK([identifier], function(releaseLockFn) {

                            var cleanup = function (full)
                            {
                                delete Gitana.APPS[req.identity_properties.token];
                                delete Gitana.PLATFORM_CACHE[req.identity_properties.token];

                                if (full) {
                                    auth.removeUserCacheEntry(identifier);
                                }
                            };

                            // null out the access token
                            // this will force the refresh token to be used to get a new one on the next request
                            req.gitana_user.getDriver().http.refresh(function (err) {

                                if (err) {
                                    cleanup(true);
                                    req.log("Invalidated auth state for gitana user: " + req.identity_properties.token);
                                    releaseLockFn();
                                    return;
                                }

                                req.gitana_user.getDriver().reloadAuthInfo(function () {
                                    cleanup(true);
                                    req.log("Refreshed token for gitana user: " + req.identity_properties.token);
                                    releaseLockFn();
                                });
                            });
                        });
                    }

                }
            });
        }
    });

    var proxyHandlerServer = http.createServer(function(req, res) {

        // used to auto-assign the client header for /oauth/token requests
        oauth2.autoProxy(req);

        // copy domain host into "x-cloudcms-domainhost"
        if (req.domainHost)
        {
            req.headers["x-cloudcms-domainhost"] = req.domainHost; // this could be "localhost"
        }

        // copy virtual host into "x-cloudcms-virtualhost"
        if (req.virtualHost)
        {
            req.headers["x-cloudcms-virtualhost"] = req.virtualHost; // this could be "root.cloudcms.net" or "abc.cloudcms.net"
        }

        // copy deployment descriptor info
        if (req.descriptor)
        {
            if (req.descriptor.tenant)
            {
                if (req.descriptor.tenant.id)
                {
                    req.headers["x-cloudcms-tenant-id"] = req.descriptor.tenant.id;
                }

                if (req.descriptor.tenant.title)
                {
                    req.headers["x-cloudcms-tenant-title"] = req.descriptor.tenant.title;
                }
            }

            if (req.descriptor.application)
            {
                if (req.descriptor.application.id)
                {
                    req.headers["x-cloudcms-application-id"] = req.descriptor.application.id;
                }

                if (req.descriptor.application.title)
                {
                    req.headers["x-cloudcms-application-title"] = req.descriptor.application.title;
                }
            }
        }

        // set optional "x-cloudcms-origin" header
        var cloudcmsOrigin = null;
        if (req.virtualHost)
        {
            cloudcmsOrigin = req.virtualHost;
        }
        if (cloudcmsOrigin)
        {
            req.headers["x-cloudcms-origin"] = cloudcmsOrigin;
        }

        // set x-cloudcms-server-version header
        req.headers["x-cloudcms-server-version"] = process.env.CLOUDCMS_APPSERVER_PACKAGE_VERSION;

        // determine the domain to set the "host" header on the proxied call
        // this is what we pass to the API server
        var cookieDomain = req.domainHost;

        // if the incoming request is coming off of a CNAME entry that is maintained elsewhere (and they're just
        // forwarding the CNAME request to our machine), then we try to detect this...
        //
        // our algorithm here is pretty weak but suffices for the moment.
        // if the req.headers["x-forwarded-host"] first entry is in the req.headers["referer"] then we consider
        // things to have been CNAME forwarded
        // and so we write cookies back to the req.headers["x-forwarded-host"] first entry domain
        /*
        var xForwardedHost = req.headers["x-forwarded-host"];
        if (xForwardedHost)
        {
            xForwardedHost = xForwardedHost.split(",");
            if (xForwardedHost.length > 0)
            {
                var cnameCandidate = xForwardedHost[0];

                var referer = req.headers["referer"];
                if (referer && referer.indexOf("://" + cnameCandidate) > -1)
                {
                    req.log("Detected CNAME: " + cnameCandidate);

                    proxyHostHeader = cnameCandidate;
                }
            }
        }
        */

        // we fall back to using http-node-proxy's xfwd support
        // thus, spoof header here on request so that "x-forwarded-host" is set properly
        //req.headers["host"] = proxyHostHeader;

        // keep alive
        req.headers["connection"] = "keep-alive";

        // allow forced cookie domains
        var forcedCookieDomain = req.headers["cloudcmscookiedomain"];
        if (!forcedCookieDomain)
        {
            if (process.env.CLOUDCMS_FORCE_COOKIE_DOMAIN)
            {
                forcedCookieDomain = process.env.CLOUDCMS_FORCE_COOKIE_DOMAIN;
            }
        }
        if (forcedCookieDomain)
        {
            cookieDomain = forcedCookieDomain;
        }

        var updateSetCookieValue = function(value)
        {
            // replace the domain with the host
            var i = value.toLowerCase().indexOf("domain=");
            if (i > -1)
            {
                var j = value.indexOf(";", i);
                if (j === -1)
                {
                    value = value.substring(0, i);
                }
                else
                {
                    value = value.substring(0, i) + value.substring(j);
                }
            }

            // if the originating request isn't secure, strip out "secure" from cookie
            if (!util.isSecure(req))
            {
                var i = value.toLowerCase().indexOf("; secure");
                if (i > -1)
                {
                    value = value.substring(0, i);
                }
            }

            // if the original request is secure, ensure cookies have "secure" set
            if (util.isSecure(req))
            {
                var i = value.toLowerCase().indexOf("; secure");
                var j = value.toLowerCase().indexOf(";secure");
                if (i === -1 && j === -1)
                {
                    value += ";secure";
                }
            }

            return value;
        };

        // handles the setting of response headers
        // we filter off stuff we do not care about
        // we ensure proper domain on set-cookie (TODO: is this needed anymore?)
        var _setHeader = res.setHeader;
        res.setHeader = function(key, value)
        {
            var _key = key.toLowerCase();

            if (_key.indexOf("access-control-") === 0)
            {
                // skip any access control headers
            }
            else
            {
                if (_key === "set-cookie")
                {
                    for (var x in value)
                    {
                        value[x] = updateSetCookieValue(value[x]);
                    }
                }

                var existing = this.getHeader(key);
                if (!existing)
                {
                    _setHeader.call(this, key, value);
                }
            }
        };

        // if the incoming request didn't have an "Authorization" header
        // and we have a logged in Gitana User via Auth, then set authorization header to Bearer Access Token
        if (!req.headers["authorization"])
        {
            if (req.gitana_user)
            {
                req.headers["authorization"] = "Bearer " + req.gitana_user.getDriver().http.accessToken();
            }
            else if (req.gitana_proxy_access_token)
            {
                req.headers["authorization"] = "Bearer " + req.gitana_proxy_access_token;
            }
        }

        if (pathPrefix) {
            req.url = path.join(pathPrefix, req.url);
        }

        proxyServer.web(req, res);
    });

    return proxyHandlerServer.listeners('request')[0];
};
