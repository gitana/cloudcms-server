var util = require("../../util/util");

/**
 * Retrieves local driver configuration for hosts from Cloud CMS.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var SENTINEL_NOT_FOUND_VALUE = "null";

    var r = {};

    var resolveConfig = r.resolveConfig = function(holder, rootStore, callback)
    {
        if (!holder.virtualHost)
        {
            return callback({
                "message": "Missing host"
            });
        }

        var completionFunction = function(err, gitanaConfig)
        {
            if (err)
            {
                callback(err);
                return;
            }

            if (gitanaConfig)
            {
                // store config
                holder.gitanaConfig = gitanaConfig;

                // remember that we found this stuff locally
                holder.gitanaLocal = true;
            }

            callback();
        };

        process.driverConfigCache.read(holder.virtualHost, function(err, cachedValue) {

            if (process.env.NULL_DRIVER_CACHE === "true") {
                cachedValue = null;
            }

            if (cachedValue)
            {
                if (cachedValue === SENTINEL_NOT_FOUND_VALUE)
                {
                    // null means there verifiably isn't anything on disk (null used as sentinel marker)
                    completionFunction();
                }
                else
                {
                    // we have something in cache
                    completionFunction(null, cachedValue.config);
                }
            }
            else
            {
                rootStore.existsFile("gitana.json", function (exists)
                {
                    if (exists)
                    {
                        // read and ensure size > 0
                        rootStore.fileStats("gitana.json", function(err, stats) {

                            // if we failed to read stats, then delete and call back with error
                            if (err)
                            {
                                return rootStore.deleteFile("gitana.json", function() {
                                    callback(err);
                                });
                            }

                            // if size 0, delete and callback with error
                            if (stats.size === 0)
                            {
                                return rootStore.deleteFile("gitana.json", function() {
                                    callback({
                                        "message": "There was a problem reading the driver configuration file.  Please reload."
                                    });
                                });
                            }

                            rootStore.readFile("gitana.json", function (err, data)
                            {
                                if (err)
                                {
                                    return completionFunction(err);
                                }

                                var gitanaConfig = null;
                                try
                                {
                                    gitanaConfig = util.jsonParse("" + data.toString());
                                }
                                catch (e)
                                {
                                    process.log("Error reading gitana.json file");
                                    completionFunction();
                                    return;
                                }

                                process.driverConfigCache.write(holder.virtualHost, {
                                    "config": gitanaConfig
                                }, function(err) {
                                    completionFunction(null, gitanaConfig);
                                });
                            });
                        });
                    }
                    else
                    {
                        // mark with sentinel
                        process.driverConfigCache.write(holder.virtualHost, SENTINEL_NOT_FOUND_VALUE, 60, function(err) {
                            completionFunction();
                        });
                    }
                });
            }
        });
    };

    r.interceptor = function()
    {
        return util.createInterceptor("driverConfig", function(req, res, next, stores, cache, configuration) {

            // if we already found req.gitanaConfig in the virtual driver, skip this step
            if (req.gitanaConfig)
            {
                return next();
            }

            var rootStore = stores.root;

            resolveConfig(req, rootStore, function(err) {

                if (err)
                {
                    req.log(err.message);
                    return next();
                }

                next();

            });

        });
    };

    return r;
}();

