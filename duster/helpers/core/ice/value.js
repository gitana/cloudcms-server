/**
 * @value
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../engine")(app, dust);
    var map = engine.map;
    var end = engine.end;

    /**
     * Displays a value and allows for optional in-context editing.
     *
     * Syntax:
     *
     *    {@value node="_doc" property="propertyName"}
     *       {propertyValue}
     *    {/value}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.value = function(chunk, context, bodies, params)
    {
        params = params || {};

        var nodeId = context.resolve(params.node);
        var propertyId = context.resolve(params.property);

        return map(chunk, function(chunk) {

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context);
                }

                var repositoryId = branch.getRepositoryId();
                var branchId = branch.getId();

                var wrapperStart = "<div class='cloudcms-value' data-repository-id='" + repositoryId + "' data-branch-id='" + branchId + "' data-node-id='" + nodeId + "'";
                if (propertyId) {
                    wrapperStart += " data-property-id='" + propertyId + "'";
                }
                wrapperStart += ">";
                var wrapperEnd = "</div>";

                chunk.write(wrapperStart);
                chunk.render(bodies.block, context);
                chunk.write(wrapperEnd);

                end(chunk, context);

            });
        });
    };

    callback();
};
