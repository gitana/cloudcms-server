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



    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Provides WCM page retrieval from Cloud CMS.
     *
     * @param directory
     * @return {Function}
     */
    r.wcmHandler = function(config)
    {
        // set up defaults
        if (config)
        {
            if (typeof(config.wcm) === "undefined")
            {
                config.wcm = true;
            }
        }

        return function(req, res, next)
        {
            if (config.wcm)
            {
                var gitana = process.gitana.appuser;
                if (gitana)
                {
                    var offsetPath = req.path;

                    var errorHandler = function(err)
                    {
                        next();
                    };

                    // find a wcm:page for this path
                    gitana.datastore("content").trap(errorHandler).readBranch("master").then(function() {

                        var branch = this;

                        this.queryNodes({
                            "_type": "wcm:page",
                            "uris": offsetPath
                        }).keepOne().then(function() {

                            // THIS = wcm:page
                            var page = this;

                            // load the template
                            Chain(branch).readNode(page.template).then(function() {

                                // THIS = wcm:template
                                var template = this;

                                // build the model
                                var model = {
                                    "page": {
                                    },
                                    "template": {
                                    }
                                };
                                if (page.title) {
                                    model.page.title = page.title;
                                }
                                if (page.description) {
                                    model.page.description = page.description;
                                }
                                if (page.keywords) {
                                    model.page.keywords = page.keywords;
                                }
                                if (template.path) {
                                    model.template.path = template.path;
                                }

                                var filePath = path.join(process.env.CLOUDCMS_APPSERVER_PUBLIC_PATH, template.path);

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
                            });

                        });
                    });
                }
                else
                {
                    // if gitana not being used, then allow other handlers to handle the request
                    next();
                }
            }
            else
            {
                next();
            }
        };
    };

    return r;
};

