var path = require('path');
var fs = require('fs');

var exports = module.exports;

exports.track = function(context, key, value)
{
    var dependencies = context.get("dependencies");
    if (!dependencies)
    {
        return;
    }

    var array = dependencies[key];
    if (!array) {
        array = [];
        dependencies[key] = array;
    }

    //console.log("Tracking: " + key + " = " + value);

    array.push(value);
};