var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("util");

var mkdirp = require('mkdirp');

/**
 * TODO: NEEDS WORK
 *
 * NEED TO CLEAN UP THIS CODE SO THAT PARAMETERS LINE UP WITH CLOUDCMS.JS AND OTHER METHODS
 * FEELING A LITTLE FUGLY
 *
 * CLOUDCMS.JS STORE LOOKUP NEEDS TO TAKE INTO ACCOUNT a) virtual host AND b) branch
 * RIGHT NOW, PATHS ARE SINGLE HOST... NEEDS WORK!
 * s
 * @type {Function}
 */
exports = module.exports = function(config)
{
    var loadFile = function(thePath, attachmentId, branchId, locale, checkVirtual, callback) {

        // paths
        var staticFileBasePath = path.join(storesPath, "cache");
        var staticFilePath = path.join(staticFileBasePath, thePath);

        var isAuthorMode = true;

        // check virtual?
        if (checkVirtual) {
            virtualFetch("virtual", branchId, locale, thePath, attachmentId, isAuthorMode, function(virtualFilePath) {

                if (virtualFilePath) {

                    fs.readFile(virtualFilePath, function(err, data) {
                        if (err) {
                            // check locally
                            fs.readFile(staticFilePath, function(err, data) {
                                callback(err, data);
                            });
                        } else {
                            callback(err, data);
                        }
                    });

                } else {

                    // check locally
                    if (fs.existsSync(staticFileBasePath)) {
                        fs.readFile(staticFilePath, function(err, data) {
                            callback(err, data);
                        });
                    } else {
                        callback();
                    }
                }
            });

        } else {
            // check locally?
            if (fs.existsSync(staticFileBasePath)) {
                fs.readFile(staticFilePath, function(err, data) {
                    callback(err, data);
                });
            } else {
                callback();
            }
        }
    };

    var loadJsonFile = function(thePath, attachmentId, branchId, locale, checkVirtual, callback) {
        loadFile(thePath, attachmentId, branchId, locale, checkVirtual, function(err, text) {
            if (err) {
                callback(err);
            } else if (text) {
                callback(err, JSON.parse(text));
            } else {
                callback();
            }
        });
    };

    var assemblePageModel = function(page)
    {
        var model = {};

        if (page.model)
        {
            // first copy in any "page" configuration
            if (page.model.page) {
                for (var k in page.model.page) {
                    model[k] = page.model.page[k]
                }
            }

            // now copy in all hash stuff
            if (page.model.hashes) {
                for (var hash in page.model.hashes) {
                    for (var k in page.model.hashes[hash]) {
                        model[k] = page.model.hashes[hash][k];
                    }
                }
            }
        }

        return model;
    };





    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    r.renderPage = function(req, res, pageId) {

        var branchId = util.determineBranchId(req);
        var locale = util.determineLocale(req);

        loadJsonFile("pages/" + pageId + ".json", null, branchId, locale, true, function(err, page) {
            if (err) {
                console.log("Unable to render page: " + pageId + ", failed to load model file, message: " + err);
                res.send(500, {
                    "message": "Unable to render page: " + pageId + ", failed to load model file",
                    "path": err.path
                });
            }
            else if (!page) {
                // a model json file for this page was not found
                console.log("A model json file for page: " + pageId + " was not found");
                res.render(pageId, {});
            }
            else {
                var model = assemblePageModel(page);
                console.log("ASSEMBLED PAGE MODEL: " + JSON.stringify(model, null, 3));

                res.render(pageId, model);
            }
        });
    };


    return r;
};

