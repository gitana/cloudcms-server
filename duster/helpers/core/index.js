/**
 * Core dust tags.
 *
 * @type {Function}
 */
module.exports = function(app, dust, callback)
{
    var filepaths = [

        "./helpers/core/cloudcms/beta/nodeAttachmentText",
        "./helpers/core/cloudcms/beta/processTemplate",
        "./helpers/core/cloudcms/beta/markdown",
        "./helpers/core/cloudcms/beta/params",

        "./helpers/core/cloudcms/associations",
        "./helpers/core/cloudcms/content",
        "./helpers/core/cloudcms/form",
        "./helpers/core/cloudcms/query",
        "./helpers/core/cloudcms/queryOne",
        "./helpers/core/cloudcms/relatives",
        "./helpers/core/cloudcms/search",
        "./helpers/core/cloudcms/searchOne",

        "./helpers/core/dev/debug",

        "./helpers/core/dom/block",
        "./helpers/core/dom/include",
        "./helpers/core/dom/layout",
        "./helpers/core/dom/link",
        "./helpers/core/dom/resource",

        "./helpers/core/ice/value",

        "./helpers/core/operators/if",
        "./helpers/core/operators/iter",
        "./helpers/core/operators/iterate"

    ];

    var support = require("../../support")(dust);

    support.addHelpers(app, dust, filepaths, function() {
        callback();
    });
};
