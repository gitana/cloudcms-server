var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var Gitana = require("gitana");

/**
 * Runtime middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    var completionFn = function(err, res, data)
    {
        if (err)
        {
            res.send({
                "ok": false,
                "message": err.message,
                "err": err
            });
            res.end();
            return;
        }

        if (!data) {
            data = {};
        }

        var x = JSON.parse(JSON.stringify(data));
        x.ok = true;

        // respond with ok
        res.status(200).send(x).end();
    };

    /**
     * JSON should look like:
     *
     *  {
      *      "branchId": "ASD",
      *      "releaseId": "ASD",
      *      "cb": "ASD"
     *  }
     *
     * @param req
     * @param host
     * @param json
     * @param callback
     */
    var doMigrate = function(req, host, json, callback)
    {
        // construct a "root" store for this host
        var storeService = require("../stores/stores");
        storeService.produce(host, function(err, stores) {

            if (err)
            {
                return callback(err);
            }

            var store = stores.content;
            store.allocated(function(allocated) {

                if (!allocated)
                {
                    return callback({
                        "message": "No content store allocated for host: " + host
                    });
                }

                var data = {};

                // generate a cache buster (in case we're in production mode)
                data.cb = new Date().getTime();
                if (json.cb) {
                    data.cb = json.cb;
                }

                // pick up release id
                data.releaseId = null;
                if (json.releaseId) {
                    data.releaseId = json.releaseId;
                }

                // pick up branch id
                data.branchId = null;
                if (json.branchId) {
                    data.branchId = json.branchId;
                }

                // create runtime
                store.writeFile("runtime.json", JSON.stringify(data, null, "  "), function(err) {
                    callback(err);
                });
            });
        });
    };

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Ensures that runtime information is loaded onto the request.
     *
     * @return {Function}
     */
    r.interceptor = function()
    {
        return function(req, res, next)
        {
            var store = req.stores.content;

            store.existsFile("runtime.json", function(exists) {

                if (exists)
                {
                    store.readFile("runtime.json", function(err, data) {

                        if (err) {
                            req.log("Error loading runtime.json");
                            return next();
                        }

                        req.runtime = JSON.parse(data);
                        next();
                    });
                }
                else
                {
                    var data = {};

                    // generate a cache buster (in case we're in production mode)
                    data.cb = new Date().getTime();

                    // release id and branch id are unknown
                    data.releaseId = null;
                    data.branchId = null;

                    // create runtime
                    store.writeFile("runtime.json", JSON.stringify(data, null, "  "), function(err) {

                        req.runtime = data;
                        next();
                    });
                }
            })
        }
    };

    /**
     * Handles retrieval of runtime status.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return function(req, res, next)
        {
            var handled = false;

            if (req.method.toLowerCase() === "get") {

                if (req.url.indexOf("/_runtime/status") === 0)
                {
                    var data = {};
                    data.runtime = req.runtime;

                    // show which branch we're running on
                    req.branch(function(err, branch) {

                        if (!err)
                        {
                            data.live = {};
                            data.live.repositoryId = branch.getRepositoryId();
                            data.live.branchId = branch.getId();
                        }

                        completionFn(null, res, data);
                    });

                    handled = true;
                }
            }
            else if (req.method.toLowerCase() === "post") {

                if (req.url.indexOf("/_runtime/migrate") === 0)
                {
                    var host = req.query["host"];
                    if (!host) {
                        host = "localhost";
                    }

                    doMigrate(req, host, req.body, function(err) {
                        completionFn(err, res);
                    });

                    handled = true;
                }

            }

            if (!handled)
            {
                next();
            }
        }
    };

    return r;
}();

