var path = require('path');
var http = require('http');
var request = require('request');
var util = require("../../util/util");
var Gitana = require("gitana");

var fs = require("fs");

var GITANA_DRIVER_CONFIG_CACHE = require("../../cache/driverconfigs");


/**
 * Retrieves virtual driver configuration for hosts from Cloud CMS.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var r = {};

    var resolveConfig = r.resolveConfig = function(holder, rootStore, callback)
    {
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

            callback(null, holder.gitanaConfig);
        };

        var cachedValue = GITANA_DRIVER_CONFIG_CACHE.read("local");
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
        }
        else
        {
            rootStore.existsFile("gitana.json", function(exists) {

                if (exists)
                {
                    rootStore.readFile("gitana.json", function(err, data) {

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

                        GITANA_DRIVER_CONFIG_CACHE.write("local", {
                            "config": gitanaConfig
                        });

                        completionFunction(null, gitanaConfig);
                    });
                }
                else
                {
                    // mark with sentinel
                    GITANA_DRIVER_CONFIG_CACHE.write("local", "null");

                    completionFunction();
                }
            });
        }
    };

    r.interceptor = function()
    {
        return util.createInterceptor("driverConfig", function(req, res, next, configuration, stores) {

            var rootStore = stores.root;

            resolveConfig(req, rootStore, function(err, gitanaConfig) {

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

