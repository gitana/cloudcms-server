var path = require('path');
var fs = require('fs');
var http = require('http');

var localeUtil = require("../util/locale");

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
     * Hands back a 404.

     * @return {Function}
     */
    r.finalHandler = function()
    {
        return function(req, res, next)
        {
            console.log("FINAL");

            // hand back a 404
            res.send(404);
            res.end();
        };
    };

    return r;
};





