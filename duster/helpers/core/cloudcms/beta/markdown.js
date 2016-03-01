var marked = require("marked");
marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false
});

/**
 * @markdown
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    /**
     * Renders markdown into the Dust template.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     * @returns {*}
     */
    dust.helpers.markdown = function(chunk, context, bodies, params) {

        params = params || {};

        var text = context.resolve(params.text);
        if (!text) {
            return chunk;
        }

        text = marked(text);

        return chunk.write(text);
    };

    callback();
};
