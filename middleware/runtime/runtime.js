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

    var TEMPLATE_RUNTIME_BRANCHES = "" + fs.readFileSync(path.join(__dirname, "../../templates/runtime_branches.html"));
    var TEMPLATE_RUNTIME_RELEASES = "" + fs.readFileSync(path.join(__dirname, "../../templates/runtime_releases.html"));

    var renderBranchesMenu = function(req, res, next)
    {
        req.branch(function(err, branch) {

            var repository = branch.getRepository();

            Chain(repository).listBranches({
                "limit": -1
            }).each(function() {
                this._active = (this.getId() === branch.getId());
            }).then(function() {

                var branches = this.asArray();

                var handlebars = require("handlebars");
                var template = handlebars.compile(TEMPLATE_RUNTIME_BRANCHES);

                var data = {
                    "branches": branches
                };
                var result = template(data);

                res.type("text/html").send(result);
            });
        });
    };

    var renderReleasesMenu = function(req, res, next)
    {
        req.branch(function(err, branch) {

            var repository = branch.getRepository();

            Chain(repository).listReleases({
                "limit": -1
            }).each(function() {
                this._active = (this.branchId === branch.getId());
            }).then(function() {

                var releases = this.asArray();

                var handlebars = require("handlebars");
                var template = handlebars.compile(TEMPLATE_RUNTIME_RELEASES);

                var data = {
                    "releases": releases
                };
                var result = template(data);

                res.type("text/html").send(result);
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
        return util.createInterceptor("runtime", function(req, res, next, stores, cache, configuration) {

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
                    // write initial file

                    var data = {};

                    // cache buster (cb)
                    data.cb = new Date().getTime();
                    if (process.env.CLOUDCMS_RUNTIME_CB) {
                        data.cb = process.env.CLOUDCMS_RUNTIME_CB;
                    }

                    // release id
                    data.releaseId = null;
                    if (process.env.CLOUDCMS_RUNTIME_RELEASE_ID) {
                        data.releaseId = process.env.CLOUDCMS_RUNTIME_RELEASE_ID;
                    }

                    // branch id
                    data.branchId = null;
                    if (process.env.CLOUDCMS_RUNTIME_BRANCH_ID) {
                        data.branchId = process.env.CLOUDCMS_RUNTIME_BRANCH_ID;
                    }

                    // create runtime file
                    store.writeFile("runtime.json", JSON.stringify(data, null, "  "), function(err) {

                        req.runtime = data;
                        next();
                    });
                }
            })
        });
    };

    /**
     * Handles retrieval of runtime status.
     *
     * @return {Function}
     */
    r.handler = function()
    {
        return util.createHandler("runtime", function(req, res, next, stores, cache, configuration) {

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
                else if (req.url.indexOf("/_runtime/branches") === 0)
                {
                    renderBranchesMenu(req, res, next);

                    handled = true;
                }
                else if (req.url.indexOf("/_runtime/releases") === 0)
                {
                    renderReleasesMenu(req, res, next);

                    handled = true;
                }

            }
            else if (req.method.toLowerCase() === "post") {

                if (req.url.indexOf("/_runtime/migrate") === 0)
                {
                    var host = req.query["host"];

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
        });
    };

    return r;
}();

