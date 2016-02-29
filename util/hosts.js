var path = require('path');
var fs = require('fs');
var util = require("./util");
var uuid = require("node-uuid");

exports = module.exports;

exports.determineHostForSocket = function(socket)
{
    var host = process.env.CLOUDCMS_VIRTUAL_HOST;
    if (!host)
    {
        // see if we are configured for virtual hosting
        var virtualHostDomain = process.env.CLOUDCMS_VIRTUAL_HOST_DOMAIN;
        if (virtualHostDomain)
        {
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

                    // find the one that is for our virtualHostDomain
                    for (var x = 0; x < candidates.length; x++)
                    {
                        // keep only those that are subdomains of our intended parent virtualHostDomain (i.e. "cloudcms.net")
                        if (candidates[x].toLowerCase().indexOf(virtualHostDomain) > -1)
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
        }
    }

    if (!host)
    {
        if (socket.handshake && socket.handshake.headers)
        {
            host = socket.handshake.headers.host;
        }
    }

    if (!host) {
        host = "localhost";
    }

    return host;
};

