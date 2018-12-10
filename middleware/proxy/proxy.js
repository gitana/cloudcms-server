var path = require('path');
var fs = require('fs');
var http = require('http');
var https = require('https');

var httpProxy = require('http-proxy');

var oauth2 = require("../../util/oauth2")();

var async = require("async");

var util = require("../../util/util");
var auth = require("../../util/auth");

/**
 * Proxy middleware.
 *
 * Supports TTL caching based on paths for anything that comes through the proxy.
 *
 * Example:
 *
 * {
 *    "proxy": {
 *       "enabled": true,
 *       "cache": [{
 *          "path": "/repositories/.*",
 *          "seconds": 60
 *       }
 *    }
 * }
 */
exports = module.exports = function()
{
    //var MAXAGE_ONE_YEAR_SECONDS = 31536000;
    //var MAXAGE_ONE_HOUR_SECONDS = 3600;
    //var MAXAGE_ONE_WEEK_SECONDS = 604800;
    //var MAXAGE_ONE_MONTH_SECONDS = 2592000;

    var _cacheTTL = function(req)
    {
        var ttl = 0;

        if (process.env.CLOUDCMS_APPSERVER_MODE === "production") {
            if (process.configuration && process.configuration.proxy) {
                if (process.configuration.proxy.enabled) {
                    if (process.configuration.proxy.cache) {
                        var elements = process.configuration.proxy.cache;
                        if (elements) {
                            for (var i = 0; i < elements.length; i++) {
                                if (elements[i].path) {
                                    var regex = new RegExp(elements[i].path);
                                    if (regex.test(req.path)) {
                                        var seconds = elements[i].seconds;
                                        if (seconds >= 0) {
                                            ttl = seconds * 1000;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return ttl;
    };

    var _handleCacheRead = function(req, callback)
    {
        var cacheTTL = _cacheTTL(req);
        if (cacheTTL <= 0)
        {
            return callback();
        }

        var contentStore = req.stores.content;
        if (!contentStore)
        {
            return callback(false);
        }

        var filePath = path.join("proxy", req.path);

        contentStore.existsFile(filePath, function(exists) {

            if (!exists) {
                callback();
                return;
            }

            contentStore.fileStats(filePath, function(err, stats) {

                if (err) {
                    callback();
                    return;
                }

                if (stats.size == 0) {
                    callback();
                    return;
                }

                var handleGoodStream = function()
                {
                    contentStore.readStream(filePath, function (err, readStream) {
                        callback(err, readStream);
                    });
                };

                var handleBadStream = function()
                {
                    contentStore.removeFile(filePath, function() {
                        contentStore.removeFile(filePath + ".cache", function() {
                            callback();
                        });
                    });
                };

                // check cacheInfo for expireTime
                contentStore.readFile(filePath + ".cache", function(err, cacheInfoText) {

                    if (err || !cacheInfoText)
                    {
                        return handleBadStream();
                    }

                    var cacheInfo = JSON.parse(cacheInfoText);
                    var expireTime = cacheInfo.expireTime;
                    if (new Date().getTime() > expireTime)
                    {
                        handleBadStream();
                    }
                    else
                    {
                        handleGoodStream();
                    }

                });
            });
        });
    };

    var _handleInvalidate = function(host, cachedPath, callback)
    {
        var stores = require("../stores/stores");
        stores.produce(host, function (err, stores) {

            if (err) {
                return callback(err);
            }

            var filePath = path.join("proxy", cachedPath);

            var contentStore = stores.content;

            contentStore.existsFile(filePath, function(exists) {

                if (!exists) {
                    return callback();
                }

                contentStore.removeFile(filePath, function() {
                    contentStore.removeFile(filePath + ".cache", function() {
                        callback();
                    });
                });
            });

        });
    };

    var _handleWrapCacheWriter = function(req, res, callback)
    {
        var cacheTTL = _cacheTTL(req);
        if (cacheTTL <= 0)
        {
            return callback();
        }

        var contentStore = req.stores.content;
        if (!contentStore)
        {
            return callback(false);
        }

        var filePath = path.join("proxy", req.path);

        contentStore.writeStream(filePath, function(err, writeStream) {

            // wrap response with a piping mechanism that caches down to disk

            // original methods
            var _write = res.write;
            var _end = res.end;

            // wrap write() method
            res.write = function(data, encoding) {

                if (writeStream) {
                    writeStream.write(data, encoding);
                }

                _write.call(res, data, encoding);
            };

            // wrap end() method
            res.end = function(data, encoding) {

                if (writeStream) {
                    writeStream.end();
                }

                // write a cache info file as well
                var cacheInfo = {
                    "expireTime": new Date().getTime() + cacheTTL
                };
                contentStore.writeFile(filePath + ".cache", JSON.stringify(cacheInfo), function() {
                    _end.call(res, data, encoding);
                });

            };

            callback();
        });
    };

    ////////////////////////////////////////////////////////////////////////////
    //
    // HTTP/HTTPS Proxy Server to Cloud CMS
    // Facilitates Cross-Domain communication between Browser and Cloud Server
    // This must appear at the top of the app.js file (ahead of config) for things to work
    //
    ////////////////////////////////////////////////////////////////////////////
    // START PROXY SERVER

    var proxyScheme = process.env.GITANA_PROXY_SCHEME;
    var proxyHost = process.env.GITANA_PROXY_HOST;
    var proxyPort = parseInt(process.env.GITANA_PROXY_PORT, 10);

    if (proxyScheme) {
        proxyScheme = proxyScheme.toLowerCase();
    }
    if (proxyHost) {
        proxyHost = proxyHost.toLowerCase();
    }

    var target = proxyScheme + "://" + proxyHost;
    if (proxyScheme === "https" && proxyPort !== 443) {
        target += ":" + proxyPort;
    }
    else if (proxyScheme === "http" && proxyPort !== 80) {
        target += ":" + proxyPort;
    }

    // NOTE: changeOrigin must be true because of the way that we set host to host:port
    // in http-proxy's common.js line 102, the host is only properly set up if changeOrigin is set to true
    // this sets the "host" header and it has to match what is set at the network/transport level in a way
    // (inner workings of Node http request)
    //
    var proxyConfig = {
        "target": target,
        "agent": http.globalAgent,
        "xfwd": false,
        "proxyTimeout": process.defaultHttpTimeoutMs,
        "changeOrigin": true
    };

    // use https?
    if (proxyScheme.toLowerCase() === "https")
    {
        proxyConfig.agent = https.globalAgent;
    }

    // create proxy server instance
    var proxyServer = new httpProxy.createProxyServer(proxyConfig);

    // error handling
    proxyServer.on("error", function(err, req, res) {
        console.log(err);
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });

        res.end('Something went wrong while proxying the request.');
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

    var _LOCK = function(lockIdentifiers, workFunction)
    {
        process.locks.lock(lockIdentifiers.join("_"), workFunction);
    };

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

        //console.log("req.domainHost = " + req.domainHost);
        //console.log("req.virtualHost = " + req.virtualHost);

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
        }

        proxyServer.web(req, res);
    });
    var proxyHandler = proxyHandlerServer.listeners('request')[0];

    var r = {};

    r.proxy = function() {

        // bind listeners for broadcast events
        bindSubscriptions.call(this);

        return util.createHandler("proxy", function(req, res, next, stores, cache, configuration) {

            if (req.url.indexOf("/proxy") === 0)
            {
                req.url = req.url.substring(6); // to strip off /proxy
                if (req.url == "")
                {
                    req.url = "/";
                }

                // caching scenario
                _handleCacheRead(req, function (err, readStream) {

                    if (!err && readStream)
                    {
                        return util.sendFile(res, readStream, function (err) {
                            // done!
                        });
                    }

                    _handleWrapCacheWriter(req, res, function(err) {

                        proxyHandler(req, res);

                    });
                });
            }
            else
            {
                next();
            }
        });
    };

    var bound = false;
    var bindSubscriptions = function()
    {
        var self = this;

        if (process.broadcast && !bound)
        {
            process.broadcast.subscribe("node_invalidation", function (message, channel, invalidationDone) {

                if (!invalidationDone) {
                    invalidationDone = function() { };
                }

                var repositoryId = message.repositoryId;
                var branchId = message.branchId;
                var nodeId = message.nodeId;

                var host = message.host;

                var path = "/repositories/" + repositoryId + "/branches/" + branchId + "/nodes/" + nodeId;

                _handleInvalidate(host, path, function(err) {
                    invalidationDone(err);
                });

            });

            bound = true;
        }
    };

    return r;
}();
