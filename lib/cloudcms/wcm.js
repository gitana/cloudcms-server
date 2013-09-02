var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("../util/util");
var localeUtil = require("../util/locale");
var mkdirp = require('mkdirp');

var Gitana = require("gitana");

var duster = require("../duster");



////////////////////////////////////////////////////////////////////////////
//
// INTERFACE METHODS
//
////////////////////////////////////////////////////////////////////////////

exports = module.exports = function(basePath)
{
    var storage = require("../util/storage")(basePath);

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
        var pages = {};
        var preloadPages = function(callback)
        {
            var errorHandler = function(err)
            {
                pages = {};
                callback(err, callback);
            };

            var pageCount = 0;
            for (var k in pages) {
                pageCount++;
            }
            if (pageCount > 0)
            {
                callback(null, pages);
                return;
            }

            var gitana = null;
            if (process.gitana) {
                gitana = process.gitana.appuser;
            }
            if (!gitana)
            {
                callback({
                    "message": "No gitana bound to this process"
                });
            }

            // load all wcm pages from the server
            gitana.datastore("content").trap(errorHandler).readBranch("master").then(function() {

                var branch = this;

                this.queryNodes({
                    "_type": "wcm:page"
                }).each(function() {

                    // THIS = wcm:page
                    var page = this;

                    if (page.uris)
                    {
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
                        Chain(branch).readNode(page.template).then(function() {

                            // THIS = wcm:template
                            var template = this;
                            page.templatePath = template.path;
                        });
                    }
                });
            }).then(function() {
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

            if (!process.gitana || !process.gitana.appuser)
            {
                next();
                return;
            }

            preloadPages(function(err, pages) {

                if (err)
                {
                    console.log("Preload pages error: " + JSON.stringify(err));
                    next();
                    return;
                }

                var offsetPath = req.path;

                // find a page for this path
                var page = pages[offsetPath];
                if (page)
                {
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

                    var filePath = path.join(process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH, page.templatePath);

                    // dust it
                    duster.execute(filePath, model, function(err, out) {

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

