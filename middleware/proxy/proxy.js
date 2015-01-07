var path = require('path');
var fs = require('fs');
var http = require('http');
var https = require('https');

var httpProxy = require('http-proxy');

var mkdirp = require('mkdirp');

var oauth2 = require("../../util/oauth2")();

var ForeverAgent = require('forever-agent');


/**
 * Proxy middleware.
 */
exports = module.exports = function()
{
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
    if (proxyScheme.toLowerCase() == "https")
    {
        /*
         //        proxyConfig.secure = true;
         */
        //https.globalAgent.options.secureProtocol = 'SSLv3_method';
        //proxyConfig.agent = https.globalAgent;

        // TODO: why does https://api.cloudcms.com throw "Hostname/IP doesn't match certificate's altname"
        // temporary workaround
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

        // keep-alive agent
        /*
        proxyConfig.agent = new https.Agent({
            maxSockets: 500,
            maxFreeSockets: 100,
            keepAlive: true,
            keepAliveMsecs: 30000
        });
        */

        proxyConfig.agent = new ForeverAgent.SSL({
            maxSockets: 500,
            maxFreeSockets: 100,
            keepAlive: true,
            keepAliveMsecs: 1000 * 60 * 5 // five minutes
        });

        //proxyConfig.agent = https.globalAgent;
        //https.globalAgent.maxSockets = Infinity;

    }
    if (proxyScheme.toLowerCase() == "http")
    {
        /*
        // keep-alive agent
        proxyConfig.agent = new http.Agent({
            maxSockets: 500,
            maxFreeSockets: 100,
            keepAlive: true,
            keepAliveMsecs: 30000
        });
        */
        //proxyConfig.agent = http.globalAgent;
        //http.globalAgent.maxSockets = Infinity;

        proxyConfig.agent = new ForeverAgent({
            maxSockets: 500,
            maxFreeSockets: 100,
            keepAlive: true,
            keepAliveMsecs: 1000 * 60 * 5 // five minutes
        });

    }
    // ten minute timeout
    // proxyConfig.timeout = 10 * 60 * 1000;
    var proxyServer = new httpProxy.createProxyServer(proxyConfig);
    proxyServer.on("error", function(err, req, res) {
        console.log(err);
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });

        res.end('Something went wrong while proxying the request.');
    });
    proxyServer.on('proxyRes', function (res) {
        //console.log('RAW Response from the target', JSON.stringify(res.headers, true, 2));
    });
    var proxyHandlerServer = http.createServer(function(req, res) {

        /*
        // make sure request socket is optimized for speed
        req.socket.setNoDelay(true);
        req.socket.setTimeout(0);
        req.socket.setKeepAlive(true, 0);

        // make sure response socket is optimized for speed
        res.socket.setNoDelay(true);
        res.socket.setTimeout(0);
        res.socket.setKeepAlive(true, 0);
        */

        // used to auto-assign the client header for /oauth/token requests
        oauth2.autoProxy(req);

        var updateSetCookieHost = function(value)
        {
            var newDomain = req.domainHost;

            // TODO: why was this needed?  CNAME wip
            /*
             if (req.headers["x-forwarded-host"]) {
             newDomain = req.headers["x-forwarded-host"];
             }
             */

            /*

             / NOTE
             // req.hostname = cloudcms-oneteam-env-58pc8mdwgg.elasticbeanstalk.com
             // req.virtualHost = tre624b7.cloudcms.net
             // req.headers["x-forwarded-host"] = terramaradmin.solocal.mobi, tre624b7.cloud$
             // req.headers["referer"] = http://terramaradmin.solocal.mobi/

             */

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

        //console.log("originalUrl: " + req.originalUrl);
        //console.log("path: " + req.path);
        //console.log("method: " + req.method);

        /*
        var re = new RegExp("^/repositories");
        if (re.test(req.path))
        {
            console.log("SET CACHE CONTROL");

            res.header("Pragma", "public");
            res.header("Cache-Control", "public, max-age=2592000");
            res.header("Expires", "Mon, 7 Apr 2015, 16:00:00 GMT"); // future
        }
        else
        {
            res.header('Cache-Control', 'no-store');
            res.header('Pragma', 'no-cache');
            res.header("Expires", "Mon, 7 Apr 2012, 16:00:00 GMT"); // already expired
        }
        */

        res.header('Cache-Control', 'no-store');
        res.header('Pragma', 'no-cache');
        res.header("Expires", "Mon, 7 Apr 2012, 16:00:00 GMT"); // already expired

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

                proxyHandler(req, res);
            }
            else
            {
                next();
            }
        };
    };

    return r;
}();

/*
 // if gitana.json is in root path, we override GITANA_PROXY_HOST, GITANA_PROXY_PORT, GITANA_PROXY_SCHEME
 if (fs.existsSync(process.env.CLOUDCMS_GITANA_JSON_PATH))
 {
 var text = fs.readFileSync(process.env.CLOUDCMS_GITANA_JSON_PATH);
 var json = JSON.parse(text);
 if (json.baseURL)
 {
 var urlObject = url.parse(json.baseURL);
 process.env.GITANA_PROXY_HOST = urlObject.hostname;
 process.env.GITANA_PROXY_PORT = urlObject.port;
 process.env.GITANA_PROXY_SCHEME = urlObject.protocol;
 if (process.env.GITANA_PROXY_SCHEME && process.env.GITANA_PROXY_SCHEME.indexOf(":") > -1)
 {
 process.env.GITANA_PROXY_SCHEME = process.env.GITANA_PROXY_SCHEME.substring(0, process.env.GITANA_PROXY_SCHEME.length - 1);
 }
 if (!process.env.GITANA_PROXY_PORT || process.env.GITANA_PROXY_PORT == "null")
 {
 if (process.env.GITANA_PROXY_SCHEME == "http")
 {
 process.env.GITANA_PROXY_PORT = 80;
 }
 else if (process.env.GITANA_PROXY_SCHEME == "https")
 {
 process.env.GITANA_PROXY_PORT = 443;
 }
 }
 console.log("Local gitana.json file found - setting proxy: " + json.baseURL);

 process.gitanaLocal = true;
 }
 }
 */

