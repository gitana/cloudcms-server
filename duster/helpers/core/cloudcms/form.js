/**
 * @form
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../engine")(app, dust);

    /**
     * FORM
     *
     * Renders a form.
     *
     * Syntax:
     *
     *    {@form definition="custom:type" form="formKey" list="listKeyOrId" successUrl="" errorUrl=""}
     *       {+templateIdentifier/}
     *    {/form}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.form = function(chunk, context, bodies, params)
    {
        return engine.handleForm(chunk, context, bodies, params);
    };

    callback();
};
