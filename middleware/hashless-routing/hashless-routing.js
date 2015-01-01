var path = require('path');
var util = require("../../util");

/**
 * TODO: this is not yet ready for prime-time
 *
 * Support for hashless URL routing.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Handles hashless routing.

     * @return {Function}
     */
    r.hashlessRoutingHandler = function()
    {
        return util.createHandler("hashless-routing", function(req, res, next, configuration, stores) {

            var webStore = stores.web;

            webStore.sendFile(res, "index.html", function (err) {

                if (err) {
                    console.log("ERR12: " + err);
                    console.log("ERR12: " + JSON.stringify(err));
                }
            });
        });
    };

    return r;
}();





