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
        return function(req, res, next)
        {
            if (!isWCMEnabled(configuration))
            {
                next();
                return;
            }

            var gitana = null;
            if (process.gitana) {
                gitana = process.gitana.appuser;
            }
            if (gitana)
            {
                var offsetPath = req.path;

                var errorHandler = function(err)
                {
                    next();
                };

                var serve = function(page, templatePath)
                {
                    // build the model
                    var model = {
                        "page": {
                        },
                        "template": {
                            "path": templatePath
                        }
                    };
                    // page keys to copy
                    for (var k in page)
                    {
                        if (k == "_doc") {
                        } else if (k.indexOf("_") === 0) {
                        } else {
                            model.page[k] = page[k];
                        }
                    }

                    var filePath = path.join(process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH, templatePath);

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
                };

                // find a wcm:page for this path
                var repository = gitana.datastore("content");
                if (repository)
                {
                    gitana.datastore("content").trap(errorHandler).readBranch("master").then(function() {

                        var branch = this;

                        this.queryNodes({
                            "_type": "wcm:page",
                            "uris": offsetPath
                        }).then(function() {

                            if (this.size() > 0)
                            {
                                this.keepOne().then(function() {

                                    // THIS = wcm:page
                                    var page = this;

                                    // is the template a GUID or a path to the template file?
                                    if (page.template.indexOf("/") > -1)
                                    {
                                        // path
                                        serve(page, page.template);
                                    }
                                    else
                                    {
                                        // load the template
                                        Chain(branch).readNode(page.template).then(function() {

                                            // THIS = wcm:template
                                            var template = this;

                                            serve(page, template.path);
                                        });
                                    }
                                });
                            }
                            else
                            {
                                // nothing available for this path
                                next();
                            }
                        });
                    });
                }
                else
                {
                    // no repository, just continue on through man
                    next();
                }
            }
            else
            {
                // if gitana not being used, then allow other handlers to handle the request
                next();
            }
        };
    };

    return r;
};

