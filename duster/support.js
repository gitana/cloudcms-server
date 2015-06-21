var async = require("async");

/**
 * Helper functions for Dust Tags
 *
 * @type {Function}
 */
exports = module.exports = function(dust)
{
    var r = {};

    var isDefined = r.isDefined = function(thing)
    {
        return (typeof(thing) !== "undefined");
    };

    var resolveVariables = r.resolveVariables = function(variables, context, callback)
    {
        if (!variables) {
            callback();
            return;
        }

        if (variables.length === 0)
        {
            callback(null, []);
            return;
        }

        async.map(variables, function(variable, callback) {

            dust.renderSource("" + variable, context, function (err, value) {

                if (err) {
                    callback(err);
                    return;
                }

                value = value.trim();

                callback(null, value);
            });

        }, function(err, results) {
            callback(err, results);
        });
    };

    /**
     * Helper function that sets the dust cursor to flushable.
     * This is to get around an apparent bug with dust:
     *
     *    https://github.com/linkedin/dustjs/issues/303
     *
     * @param chunk
     * @param callback
     * @returns {*}
     */
    var map = r.map = function(chunk, callback)
    {
        var cursor = chunk.map(function(branch) {
            callback(branch);
        });
        cursor.flushable = true;

        return cursor;
    };

    /**
     * Helper function to end the chunk.  This is in place because it's unclear exactly what is needed to counter
     * the issue mentioned in:
     *
     *    https://github.com/linkedin/dustjs/issues/303
     *
     * At one point, it seemed that some throttling of the end() call was required.  It may still be at some point.
     * So for now, we use this helper method to end() since it lets us inject our own behaviors if needed.
     *
     * @param chunk
     * @param context
     */
    var end = r.end = function(chunk, context)
    {
        chunk.end();
    };

    var _MARK_INSIGHT = r._MARK_INSIGHT = function(node, result)
    {
        result.insightNode = node.getRepositoryId() + "/" + node.getBranchId() + "/" + node.getId();
    };

    return r;
};
