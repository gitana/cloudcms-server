/**
 * @nodeAttachmentText
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

    dust.helpers.nodeAttachmentText = dust.helpers.nodeAttachmentValue = function(chunk, context, bodies, params)
    {
        params = params || {};

        var nodeId = context.resolve(params.node);
        var attachmentId = context.resolve(params.attachment);
        if (!attachmentId)
        {
            attachmentId = "default";
        }

        return map(chunk, function(chunk) {

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context);
                }

                branch.readNode(nodeId).attachment(attachmentId).download(function(text) {

                    chunk.write(text);

                    end(chunk, context);
                });
            });
        });
    };

    callback();
};
