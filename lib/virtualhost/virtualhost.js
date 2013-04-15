var path = require('path');
var fs = require('fs');
var http = require('http');

var util = require("../util/util");

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Host interceptor.
     *
     * This interceptor is the first in the chain.  It looks at the DNS and figures out where on disk the
     * primary HTML files live.  The primary HTML files are customer's files that they previously deployed
     * for a given deployment key.
     *
     * @return {Function}
     */
    r.interceptor = function()
    {
        return function(req, res, next)
        {
            // try to determine the virtual host
            //var host = req.host;
            var host = null;
            if (req.header("X-Forwarded-Host")) {
                host = req.header("X-Forwarded-Host");
            }

            if (host)
            {
                storage.existsHostDirectory(host, function(exists) {

                    if (exists)
                    {
                        // load the descriptor
                        var descriptorFilePath = path.join(storage.hostDirectoryPath(host), "descriptor.json");
                        fs.readFile(descriptorFilePath, function(err, descriptor) {

                            if (err)
                            {
                                // no file descriptor, virtual host not deployed
                                next();
                                return;
                            }

                            // convert descriptor to JSON
                            descriptor = JSON.parse(descriptor);

                            // first check to see if we're inactive
                            if (!descriptor.active)
                            {
                                // we're inactive, virtual host not deployed
                                next();
                                return;
                            }

                            // yes, virtual host deployed, store a few interesting things on the request

                            // write descriptor to request
                            req.descriptor = descriptor;

                            // write the base host directory to req
                            req.virtualHostDirectoryPath = storage.hostDirectoryPath(host);

                            // also store the virtual host we mapped to
                            req.virtualHost = host;

                            next();

                        });
                    }
                    else
                    {
                        next();
                    }

                });
            }
            else
            {
                next();
            }
        }
    };

    return r;
};

