var util = require("../../util/util");

/**
 * Looks for a "descriptor.json" in the root store and if it finds it, loads it to req.descriptor and sets
 * req.virtualFiles == true.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var SENTINEL_NOT_FOUND_VALUE = "null";

    var r = {};

    r.interceptor = function()
    {
        return util.createInterceptor("virtualFiles", function (req, res, next, stores, cache, configuration) {

            var completionFunction = function (err, descriptor) {

                if (err) {
                    console.log("ERR: ", err);

                    // something went wrong
                    return next();
                }

                if (!descriptor) {
                    // nothing found
                    return next();
                }

                // yes, virtual host deployed, store a few interesting things on the request

                // write descriptor to request
                req.descriptor = descriptor;

                // first check to see if we're inactive
                if (!descriptor.active) {
                    // we're inactive, virtual host not running
                    // send back a 404
                    util.status(res, 404).end();
                    return;
                }

                // mark that we're able to handle virtual files
                req.virtualFiles = true;

                // continue middleware chain
                next();
            };

            var rootStore = stores.root;

            // CACHE: is there a cached descriptor for this host?
            // NOTE: null is a valid sentinel value (meaning none)
            process.deploymentDescriptorCache.read(req.virtualHost, function(err, descriptor) {

                // check for null sentinel
                if (descriptor === SENTINEL_NOT_FOUND_VALUE) {
                    return completionFunction();
                }

                if (typeof(descriptor) !== "undefined" || descriptor === null) {
                    // all done
                    return completionFunction(null, descriptor);
                }

                // nothing in cache, load from disk
                // check if there is a descriptor on disk
                rootStore.existsFile("descriptor.json", function (exists) {

                    if (exists) {

                        // load the descriptor
                        rootStore.readFile("descriptor.json", function (err, descriptor) {

                            if (err) {
                                // no file descriptor, virtual files not deployed
                                next();
                                return;
                            }

                            // yes, there is a descriptor, so we have virtual files

                            // convert descriptor to JSON
                            descriptor = JSON.parse(descriptor);

                            // CACHE: write
                            process.deploymentDescriptorCache.write(req.virtualHost, descriptor, function() {

                                // all done
                                completionFunction(null, descriptor);

                            });

                        });
                    }
                    else
                    {
                        // write null sentinel and return nothing
                        process.deploymentDescriptorCache.write(req.virtualHost, SENTINEL_NOT_FOUND_VALUE, function() {
                            completionFunction();
                        });
                    }
                });
            });

        });
    };

    return r;
}();

