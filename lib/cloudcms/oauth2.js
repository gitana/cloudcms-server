var path = require('path');
var fs = require('fs');
var http = require('http');

exports = module.exports = function()
{
    var r = {};

    /**
     * Helper method that can be called for a given request ahead of any processing.  This method checks to see whether
     * a Gitana driver is mounted onto the request.  If so and if the request is for an OAuth2 token exchange and it
     * lacks client key + secret information, then this method injects the correct OAuth2 client bearer authorization
     * header into the request.
     *
     * This allows the OAuth2 token request to proceed and work as intended.
     *
     * The reason this exists is to support pure HTML5/JavaScript applications that run entirely in the browser.
     * Since the browser is not secure, we allow for those applications to use the Gitana driver *without* providing
     * the clientKey and clientSecret.
     *
     * The clientKey and clientSecret are mandatory and required for connection to the Cloud CMS server.  If the
     * connection were direct from the browser to the Cloud CMS server, there would be not exceptions to this rule.
     *
     * However, to support the browser application, a Cloud CMS customer may deploy an "application server" which
     * consists of this Node.js application.  The application server is wired via the gitana.json file to a single
     * application and client key/secret.  The browser is allowed to communicate openly and publicly with the
     * application server.  Any calls to the application server are already understood to originate from the clientKey
     * and clientSecret for the application server (in so far as Cloud CMS is concerned).
     *
     * Thus, the browser does not need to have the client key and secret made available to it.  The customer is free
     * to deploy new client keys and secrets to the application server at any time.  The browser makes calls to the
     * application server, the application server then plugs in the appropriate client key/secret via this method,
     * and the browser never gets to discover the client key/secret pair.
     *
     * @return {Function}
     */
    r.autoProxy = function(req)
    {
        if (req.gitanaConfig)
        {
            if (req.method.toLowerCase() == "get")
            {
                if (req.url.indexOf("/oauth/token") === 0)
                {
                    autoClientBearer(req);
                }
                /*
                else if (req.url.indexOf("/oauth/authorize") == 0)
                {
                    console.log("PROXY OAUTH2 AUTHORIZE");
                    autoClientBearer(req);
                }
                */
            }
        }
    };

    var autoClientBearer = function(req)
    {
        var validAuthorizationHeader = false;

        if (req.headers)
        {
            var authorizationHeader = req.headers["Authorization"];
            if (authorizationHeader)
            {
                var z = authorizationHeader.indexOf("Basic ");
                if (z === 0)
                {
                    var byte64string = authorizationHeader.substring(6);
                    var clientKeySecret = new Buffer(byte64string, 'base64').toString('ascii');
                    if (clientKeySecret)
                    {
                        z = clientKeySecret.indexOf(":");
                        if (z > -1)
                        {
                            var clientKey = clientKeySecret.substring(0, z);
                            var clientSecret = clientKeySecret.substring(z+1);
                            if (clientKey && clientKey.length > 0)
                            {
                                if (clientSecret && clientSecret.length > 0)
                                {
                                    validAuthorizationHeader = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (validAuthorizationHeader)
        {
            // we get out of the way
            return;
        }

        // process by hand so that we can inject the client key/secret

        var clientKeySecret = req.gitanaConfig.clientKey + ":" + req.gitanaConfig.clientSecret;

        var clientAuthorizationHeader = "Basic " + new Buffer(clientKeySecret).toString('base64');

        if (!req.headers)
        {
            req.headers = {};
        }
        req.headers["Authorization"] = clientAuthorizationHeader;

        //console.log("Injected authorization: " + clientAuthorizationHeader);
    };

    return r;
};

