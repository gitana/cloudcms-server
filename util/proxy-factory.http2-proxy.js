var http = require("http");
var https = require("https");
var path = require("path");

var auth = require("./auth");
var util = require("./util");

var oauth2 = require("./oauth2")();

var urlTool = require("url");
const finalhandler = require("finalhandler");

var LRU = require("lru-cache");

var exports = module.exports;

var _LOCK = function(lockIdentifiers, workFunction)
{
    var name = lockIdentifiers.join("_");
    process.locks.lock(name, workFunction);
};

var NAMED_PROXY_HANDLERS_CACHE = new LRU({
    max: 200,
    ttl: 1000 * 60 * 60 // 60 minutes
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
            console.log("Failed to acquire proxy handler: " + name + ", err: ", err);
            
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
        //console.log("Acquiring proxy handler: " + name + ", for target: " + proxyTarget + " and prefix: " + pathPrefix);
        _cachedHandler = createProxyHandler(proxyTarget, pathPrefix);
    
        // store back into LRU cache
        NAMED_PROXY_HANDLERS_CACHE[name] = _cachedHandler;

        releaseLockFn();
        callback(null, _cachedHandler);
    });
};




var createProxyHandler = function(proxyTarget, pathPrefix)
{
    const proxy = require("http2-proxy");
    const finalhandler = require('finalhandler')
    
    const defaultWebHandler = function(err, req, res) {
        if (err)
        {
            console.log("A web proxy error was caught, path: " + req.path + ", err: ", err);
            try { res.status(500); } catch (e) { }
            try { res.end('Something went wrong while proxying the request.'); } catch (e) { }
        }
    
        finalhandler(req, res)(err);
    };
    
    // const defaultWsHandler = function(err, req, socket, head) {
    //     if (err) {
    //         console.error('proxy error (ws)', err);
    //         socket.destroy();
    //     }
    // };
    
    //console.log("Proxy Target: " + proxyTarget);
    
    var hostname = urlTool.parse(proxyTarget).hostname;
    var port = urlTool.parse(proxyTarget).port;
    var protocol = urlTool.parse(proxyTarget).protocol;
    
    // web
    var webConfig = {};
    webConfig.hostname = hostname;
    webConfig.port = port;
    webConfig.protocol = protocol;
    //webConfig.path = null;
    webConfig.timeout = 120000;
    webConfig.proxyTimeout = 120000;
    webConfig.proxyName = "Cloud CMS UI Proxy";
    webConfig.onReq = function(req, options) {

        if (!options.headers) {
            options.headers = {};
        }
        var headers = options.headers;

        if (options.path && options.path.startsWith("/proxy")) {
            options.path = options.path.substring(6);
        }
    
        if (pathPrefix) {
            options.path = path.join(pathPrefix, options.path);
        }
        
        // used to auto-assign the client header for /oauth/token requests
        oauth2.autoProxy(req);
    
        // copy domain host into "x-cloudcms-domainhost"
        if (req.domainHost) {
            headers["x-cloudcms-domainhost"] = req.domainHost; // this could be "localhost"
        }
    
        // copy virtual host into "x-cloudcms-virtualhost"
        if (req.virtualHost) {
            headers["x-cloudcms-virtualhost"] = req.virtualHost; // this could be "root.cloudcms.net" or "abc.cloudcms.net"
        }
    
        // copy deployment descriptor info
        if (req.descriptor)
        {
            if (req.descriptor.tenant)
            {
                if (req.descriptor.tenant.id)
                {
                    headers["x-cloudcms-tenant-id"] = req.descriptor.tenant.id;
                }
            
                if (req.descriptor.tenant.title)
                {
                    headers["x-cloudcms-tenant-title"] = req.descriptor.tenant.title;
                }
            }
        
            if (req.descriptor.application)
            {
                if (req.descriptor.application.id)
                {
                    headers["x-cloudcms-application-id"] = req.descriptor.application.id;
                }
            
                if (req.descriptor.application.title)
                {
                    headers["x-cloudcms-application-title"] = req.descriptor.application.title;
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
            headers["x-cloudcms-origin"] = cloudcmsOrigin;
        }
    
        // set x-cloudcms-server-version header
        headers["x-cloudcms-server-version"] = process.env.CLOUDCMS_APPSERVER_PACKAGE_VERSION;
    
        // keep alive
        //req.headers["connection"] = "keep-alive";
    
        // if the incoming request didn't have an "Authorization" header
        // and we have a logged in Gitana User via Auth, then set authorization header to Bearer Access Token
        if (!req.headers["authorization"])
        {
            if (req.gitana_user)
            {
                headers["authorization"] = "Bearer " + req.gitana_user.getDriver().http.accessToken();
            }
            else if (req.gitana_proxy_access_token)
            {
                headers["authorization"] = "Bearer " + req.gitana_proxy_access_token;
            }
        }
    };
    webConfig.onRes = function(req, res, proxyRes) {
    
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

                        _LOCK([identifier], function(err, releaseLockFn) {

                            if (err)
                            {
                                // failed to acquire lock
                                console.log("FAILED TO ACQUIRE LOCK", err);
                                req.log("FAILED TO ACQUIRE LOCK", err);
                                try { releaseLockFn(); } catch (e) { }
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
                                    return releaseLockFn();
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
        
        //res.setHeader('x-powered-by', 'cloudcms');
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
    };
    
    var proxyRequestHandler = function(req, res) {
        proxy.web(req, res, webConfig, function(err, req, res) {
            defaultWebHandler(err, req, res);
        });
    };
    
    // cookie domain rewrite?
    // not needed - this is handled intrinsically by http2-proxy

    return proxyRequestHandler;
};
