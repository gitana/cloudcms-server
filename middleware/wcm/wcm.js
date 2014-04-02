var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../../util/util");
var mkdirp = require('mkdirp');
var duster = require("../../duster");

/**
 * WCM middleware.
 *
 * Serves up HTML pages based on WCM configuration.  Applies duster tag processing.
 *
 * @type {Function}
 */
exports = module.exports = function(basePath)
{
    var storage = require("../../util/storage")(basePath);

    var isWCMEnabled = function(configuration)
    {
        var enabled = false;

        if (configuration && configuration.wcm)
        {
            if (typeof(configuration.wcm.enabled) != "undefined")
            {
                enabled = configuration.wcm.enabled;
            }
        }

        return enabled;
    };


    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Provides WCM page retrieval from Cloud CMS.
     *
     * @param configuration
     * @return {Function}
     */
    r.wcmHandler = function(configuration)
    {
        // assume thirty seconds (for development mode)
        var WCM_CACHE_TIMEOUT = 60 * 1000 * 0.5; // 30 seconds
        if (process.env.CLOUDCMS_APPSERVER_MODE == "production")
        {
            // for production, set to 24 hours
            WCM_CACHE_TIMEOUT = 60 * 1000 * 60 * 24;
        }

        var preloadPages = function(req, callback)
        {
            var gitana = req.gitana;

            var cacheValid = false;

            var pages = req.cache.read("wcmPages");
            var pagesTimestamp = req.cache.read("wcmPagesTimestamp");
            var now = new Date().getTime();

            // do a quick page count check
            var pageCount = 0;
            if (pages)
            {
                for (var k in pages) {
                    pageCount++;
                }
            }

            //console.log("WCM cached page count: " + pageCount + " with timestamp: " + pagesTimestamp);
            //console.log("Now is: " + now + " with difference: " + (now - pagesTimestamp));

            if (pagesTimestamp && pagesTimestamp > 0)
            {
                if (now - pagesTimestamp > WCM_CACHE_TIMEOUT)
                {
                    //console.log("WCM cache invalid -> exceeded 30 seconds");
                    cacheValid = false;
                }
                else
                {
                    //console.log("WCM cache valid");
                    cacheValid = true;
                }

                if (pageCount == 0)
                {
                    // force invalid
                    //console.log("WCM page count == 0, forcing invalid");
                    cacheValid = false;
                }
            }

            // allow for forced invalidation via req param
            if (req.param("invalidate"))
            {
                //console.log("Forcing cache invalidation via request param");
                cacheValid = false;
            }

            if (cacheValid)
            {
                //console.log("WCM responds from cache");
                callback(null, pages);
                return;
            }

            console.log("WCM populate cache, cache timeout: " + WCM_CACHE_TIMEOUT);
            pages = {};

            // cache is not valid, let's populate it
            req.cache.clear("wcmPages");
            req.cache.clear("wcmPagesTimestamp");

            var errorHandler = function(err)
            {
                req.log("WCM populate cache err: " + JSON.stringify(err));
                //console.log("WCM populate cache err: " + err);
                //console.log("WCM populate cache err2: " + JSON.stringify(err));
                //console.log("WCM populate cache err3: " + err.message);

                callback(err);
            };

            // load all wcm pages from the server
            var repository = gitana.datastore("content");
            if (!repository)
            {
                req.log("Cannot find 'content' datastore for gitana instance");

                callback({
                    "message": "Cannot find 'content' datastore for gitana instance"
                });

                return;
            }

            //var t1 = new Date().getTime();
            Chain(repository).trap(errorHandler).readBranch("master").then(function() {

                var branch = this;

                this.queryNodes({
                    "_type": "wcm:page"
                }, {
                    "limit": -1
                }).each(function() {

                    // THIS = wcm:page
                    var page = this;

                    // if page has a template
                    if (page.template)
                    {
                        if (page.uris)
                        {
                            // merge into our pages collection
                            for (var i = 0; i < page.uris.length; i++)
                            {
                                pages[page.uris[i]] = page;
                            }
                        }

                        // is the template a GUID or a path to the template file?
                        if (page.template.indexOf("/") > -1)
                        {
                            page.templatePath = page.template;
                        }
                        else
                        {
                            // load the template
                            this.subchain(branch).readNode(page.template).then(function() {

                                // THIS = wcm:template
                                var template = this;
                                page.templatePath = template.path;
                            });
                        }
                    }
                });

            }).then(function() {

                //var t2 = new Date().getTime();

                //console.log("WCM page time: " + (t2-t1));

                //console.log("Writing pages to WCM cache");
                //for (var uri in pages)
                //{
                //    console.log(" -> " + uri);
                //}

                req.cache.write("wcmPages", pages);
                req.cache.write("wcmPagesTimestamp", new Date().getTime());

                callback(null, pages);
            });
        };

        return function(req, res, next)
        {
            if (!isWCMEnabled(configuration))
            {
                next();
                return;
            }

            if (!req.gitana)
            {
                next();
                return;
            }

            preloadPages(req, function(err, pages) {

                if (err)
                {
                    next();
                    return;
                }

                var offsetPath = req.path;

                // find a page for this path
                var page = pages[offsetPath];
                if (page)
                {
                    if (!req.helpers) {
                        req.helpers = {};
                    }
                    req.helpers.page = page;

                    // build the model
                    var model = {
                        "page": {
                        },
                        "template": {
                            "path": page.templatePath
                        }
                    };
                    // page keys to copy
                    for (var k in page)
                    {
                        if (k == "templatePath") {

                        } else if (k == "_doc") {
                        } else if (k.indexOf("_") === 0) {
                        } else {
                            model.page[k] = page[k];
                        }
                    }

                    var filePath = path.join(util.publicPath(req, storage), page.templatePath);

                    // dust it
                    duster.execute(req, filePath, model, function(err, out) {

                        if (err)
                        {
                            res.send(500, err);
                        }
                        else
                        {
                            res.send.call(res, 200, out);
                        }

                    });
                }
                else
                {
                    next();
                }
            });
        }
    };

    return r;
};

