var path = require('path');
var http = require('http');
var request = require('request');
var util = require("../../util/util");
var Gitana = require("gitana");

var fs = require("fs");

/**
 * Retrieves local driver configuration for hosts from Cloud CMS.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var r = {};

    var resolveConfig = r.resolveConfig = function(holder, rootStore, callback)
    {
        if (!holder.virtualHost)
        {
            callback({
                "message": "Missing host"
            });
            return;
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
                // overwrite path to gitana.json file
                holder.gitanaConfig = gitanaConfig;

                // remember that we found this stuff locally
                holder.gitanaLocal = true;
            }

            callback();
        };


        process.driverConfigCache.read(holder.virtualHost, function(err, cachedValue) {

            if (cachedValue)
            {
                if (cachedValue == "null")
                {
                    // null means there verifiably isn't anything on disk (null used as sentinel marker)
                    completionFunction();
                }
                else
                {
                    // we have something in cache
                    completionFunction(null, cachedValue.config);
                }
            } else
            {
                rootStore.existsFile("gitana.json", function (exists)
                {
                    if (exists)
                    {
                        rootStore.readFile("gitana.json", function (err, data)
                        {

                            if (err)
                            {
                                completionFunction(err);
                                return;
                            }

                            var gitanaConfig = null;
                            try
                            {
                                gitanaConfig = JSON.parse(data.toString());
                            }
                            catch (e)
                            {
                                console.log("Error reading gitana.json file");
                                completionFunction();
                                return;
                            }

                            process.driverConfigCache.write(holder.virtualHost, {
                                "config": gitanaConfig
                            }, function(err) {
                                completionFunction(null, gitanaConfig);
                            });
                        });
                    }
                    else
                    {
                        // mark with sentinel
                        process.driverConfigCache.write(holder.virtualHost, "null", function(err) {
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
                    next();
                    return;
                }

                next();

            });

        });
    };

    return r;
}();

