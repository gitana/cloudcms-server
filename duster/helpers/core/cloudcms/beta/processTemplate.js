/**
 * @processTemplate
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../../engine")(app, dust);

    var map = engine.map;
    var end = engine.end;

    dust.helpers.processTemplate = function(chunk, context, bodies, params)
    {
        params = params || {};

        var nodeId = context.resolve(params.node);
        var attachmentId = context.resolve(params.attachment);
        if (!attachmentId)
        {
            attachmentId = "default";
        }
        var propertyId = context.resolve(params.property);
        var locale = context.resolve(params.locale);

        return map(chunk, function(chunk) {

            if (locale)
            {
                var gitana = context.get("gitana");
                gitana.getDriver().setLocale(locale);
            }

            if (propertyId)
            {
                var req = context.get("req");
                req.branch(function(err, branch) {

                    if (err) {
                        return end(chunk, context);
                    }

                    branch.readNode(nodeId).then(function() {

                        resolveVariables([this[propertyId]], context, function (err, resolutions) {

                            chunk.write(resolutions[0]);

                            end(chunk, context);

                        });
                    });
                });
            }
            else
            {
                var req = context.get("req");
                req.branch(function(err, branch) {

                    if (err) {
                        return end(chunk, context);
                    }

                    branch.readNode(nodeId).attachment(attachmentId).download(function (text) {

                        resolveVariables([text], context, function (err, resolutions) {

                            chunk.write(resolutions[0]);

                            end(chunk, context);

                        });
                    });
                });
            }
        });
    };

    callback();
};
