var fs = require('fs');
var path = require('path');

exports = module.exports;

// determines the locale for the current request
exports.determineLocale = function(req) {

    var locale = "default";

    if (req.locale) {
        locale = req.locale;
    }

    if (req.query && req.query.locale) {
        locale = req.query.locale;
    }

    return locale;
};
