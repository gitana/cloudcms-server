var path = require('path');
var fs = require('fs');
var http = require('http');
var https = require('https');

var httpProxy = require('http-proxy');

var oauth2 = require("../../util/oauth2")();

//var ForeverAgent = require('forever-agent');

var ForeverAgent = require('../../temp/forever-agent');

var util = require("../../util/util");

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
    var MAXAGE_ONE_YEAR_SECONDS = 31536000;
    var MAXAGE_ONE_HOUR_SECONDS = 3600;
    var MAXAGE_ONE_WEEK_SECONDS = 604800;
    var MAXAGE_ONE_MONTH_SECONDS = 2592000;

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
            callback();
            return;
        }

        var contentStore = req.stores.content;
        if (!contentStore)
        {
            callback(false);
            return;
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
                        handleBadStream();
                        return;
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

    var _handleWrapCacheWriter = function(req, res, callback)
    {
        var cacheTTL = _cacheTTL(req);
        if (cacheTTL <= 0)
        {
            callback();
            return;
        }

        var contentStore = req.stores.content;
        if (!contentStore)
        {
            callback(false);
            return;
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

    var target = proxyScheme + "://" + proxyHost + ":" + proxyPort;
    var proxyConfig = {
        "target": target,
        "agent": false,
        "xfwd": true
    };

    if (proxyScheme.toLowerCase() === "https")
    {
        proxyConfig.agent = new ForeverAgent.SSL({
            maxSockets: 500,
            maxFreeSockets: 100
        });
    }
    else if (proxyScheme.toLowerCase() === "http")
    {
        proxyConfig.agent = new ForeverAgent({
            maxSockets: 500,
            maxFreeSockets: 100
        });
    }

    proxyConfig.keepAlive = true;
    proxyConfig.keepAliveMsecs = 1000 * 60 * 5;

    var proxyServer = new httpProxy.createProxyServer(proxyConfig);

    // error handling
    proxyServer.on("error", function(err, req, res) {
        console.log(err);
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });

        res.end('Something went wrong while proxying the request.');
    });

    var proxyHandlerServer = http.createServer(function(req, res) {

        // used to auto-assign the client header for /oauth/token requests
        oauth2.autoProxy(req);

        var updateSetCookieHost = function(value)
        {
            var newDomain = req.domainHost;

            //
            // if the incoming request is coming off of a CNAME entry that is maintained elsewhere (and they're just
            // forwarding the CNAME request to our machine), then we try to detect this...
            //
            // our algorithm here is pretty weak but suffices for the moment.
            // if the req.headers["x-forwarded-host"] first entry is in the req.headers["referer"] then we consider
            // things to have been CNAME forwarded
            // and so we write cookies back to the req.headers["x-forwarded-host"] first entry domain
            //

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

                        newDomain = cnameCandidate;
                    }
                }
            }

            // allow forced cookie domains
            var forcedCookieDomain = req.headers["cloudcmscookiedomain"];
            if (forcedCookieDomain)
            {
                newDomain = forcedCookieDomain;
            }

            // now proceed

            var i = value.indexOf("Domain=");
            if (i > -1)
            {
                var j = value.indexOf(";", i);
                if (j > -1)
                {
                    value = value.substring(0, i+7) + newDomain + value.substring(j);
                }
                else
                {
                    value = value.substring(0, i+7) + newDomain;
                }
            }

            return value;
        };

        var _setHeader = res.setHeader;
        res.setHeader = function(key, value)
        {
            if (key.toLowerCase() === "set-cookie")
            {
                for (var x in value)
                {
                    value[x] = updateSetCookieHost(value[x]);
                }
            }

            var existing = this.getHeader(key);
            if (!existing) {
                _setHeader.call(this, key, value);
            }
        };

        util.setHeaderOnce(res, "Cache-Control", "no-store");
        util.setHeaderOnce(res, "Pragma", "no-cache");
        util.setHeaderOnce(res, "Expires", "Mon, 7 Apr 2012, 16:00:00 GMT"); // already expired

        proxyServer.web(req, res);
    });
    var proxyHandler = proxyHandlerServer.listeners('request')[0];

    var r = {};

    r.proxy = function() {
        return function(req, res, next)
        {
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
                        util.sendFile(res, readStream, function (err) {
                            // done!
                        });
                        return;
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
        };
    };

    return r;
}();
