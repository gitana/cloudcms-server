var http = require("http");
var https = require("https");
var path = require("path");

var httpProxy = require("../temp/http-proxy");

var auth = require("./auth");
var util = require("./util");

var oauth2 = require("./oauth2")();

var urlTool = require("url");

var exports = module.exports;

var _LOCK = function(lockIdentifiers, workFunction)
{
    var name = lockIdentifiers.join("_");
    process.locks.lock(name, workFunction);
};

var NAMED_PROXY_HANDLERS_CACHE = require("lru-cache")({
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
    _LOCK(["acquireProxyHandler", name], function(err, releaseLockFn) {
        
        if (err)
        {
            // failed to acquire lock
            return callback(err);
        }

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
    
    // parse the target to get host
    var proxyHost = urlTool.parse(proxyTarget).host;
    
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
        "timeout": process.defaultHttpTimeoutMs,
        //"changeOrigin": true
        "headers": {
            "host": proxyHost
        },
        "cookieDomainRewrite": true
    };

    // use https?
    if (util.isHttps(proxyTarget))
    {
        proxyConfig = {
            "target": proxyTarget,
            "agent": https.globalAgent,
            "xfwd": false,
            "proxyTimeout": process.defaultHttpTimeoutMs,
            "timeout": process.defaultHttpTimeoutMs,
            "headers": {
                "host": proxyHost
            },
            "cookieDomainRewrite": true
        };
    }
    
    console.log("Using proxy config: " + proxyConfig);

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
        
        console.log("proxyRes.1");
        
        if (req.gitana_user)
        {
            var chunks = [];
            // triggers on data receive
            proxyRes.on('data', function(chunk) {
                // add received chunk to chunks array
                chunks.push(chunk);
            });

            proxyRes.on("end", function () {
    
                console.log("proxyRes.end, code: " + proxyRes.statusCode);

                if (proxyRes.statusCode === 401)
                {
                    var text = "" + Buffer.concat(chunks);
                    if (text && (text.indexOf("invalid_token") > -1) || (text.indexOf("invalid_grant") > -1))
                    {
                        var identifier = req.identity_properties.provider_id + "/" + req.identity_properties.user_identifier;

                        _LOCK([identifier], function(err, releaseLockFn) {
    
                            if (err)
                            {
                                // failed to acquire lock
                                console.log("FAILED TO ACQUIRE LOCK", err);
                                req.log("FAILED TO ACQUIRE LOCK", err);
                                return;
                            }
    
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

        console.log("proxy.1: " + req.url);
        if (req.headers)
        {
            for (var k in req.headers)
            {
                console.log("proxy.2 header " + k + " = " + req.headers[k]);
            }
        }

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
    
        // keep alive
        req.headers["connection"] = "keep-alive";

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
    
        console.log("proxy.4: " + req.url);
        if (req.headers)
        {
            for (var k in req.headers)
            {
                console.log("proxy.4 header " + k + " = " + req.headers[k]);
            }
        }

        proxyServer.web(req, res);
        
        console.log("proxy.5");
    });

    return proxyHandlerServer.listeners('request')[0];
};
