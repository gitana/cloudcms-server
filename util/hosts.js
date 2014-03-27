var path = require('path');
var fs = require('fs');
var util = require("./util");
var uuid = require("node-uuid");

exports = module.exports;

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

exports.determineHostForRequest = function(configuration, req)
{
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
    if (configuration.virtualHost && configuration.virtualHost.hostHeader)
    {
        var customHost = req.header[configuration.virtualHost.hostHeader];
        push(candidates, customHost);
    }

    // REQ.HOST
    push(candidates, req.host);

    // find the one that is "cloudcms.net"
    //console.log("Resolving host from candidates: ");
    var host = null;
    for (var x = 0; x < candidates.length; x++)
    {
        //console.log("Candidate " + x + ": " + candidates[x]);

        // keep "cloudcms.net"
        if (candidates[x].indexOf(".cloudcms.net") > -1)
        {
            host = candidates[x];
            break;
        }
    }
    //console.log("Resolved host: " + host);

    // if none, take first one that is not an IP address
    if (!host)
    {
        if (candidates.length > 0)
        {
            for (var i = 0; i < candidates.length; i++)
            {
                if (!util.isIPAddress(candidates[i]))
                {
                    host = candidates[i];
                    break;
                }
            }
        }
    }

    return host;
};

exports.determineHostForSocket = function(socket)
{
    var host = null;

    // check headers
    if (socket.handshake && socket.handshake.headers)
    {
        host = socket.handshake.headers.host;
        if (socket.handshake.headers["x-forwarded-host"])
        {
            host = socket.handshake.headers["x-forwarded-host"];
        }
    }

    // if we have a host, process a bit further
    if (host)
    {
        // if multiple hosts come our way
        if (host.indexOf(",") > -1)
        {
            var candidates = host.split(",");

            // find the one that is "cloudcms.net"
            for (var x = 0; x < candidates.length; x++)
            {
                if (candidates[x].indexOf(".cloudcms.net") > -1)
                {
                    host = candidates[x];
                    break;
                }
            }
        }

        // trim host for safe measure
        host = util.trim(host);

        // strip out port if it's on there
        var x = host.indexOf(":");
        if (x > -1)
        {
            host = host.substring(0, x);
        }
    }

    return host;
};