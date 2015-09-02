var path = require('path');
var fs = require('fs');

var exports = module.exports;

exports.trackDependency = function(context, key, value)
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

    if (array.indexOf(value) === -1)
    {
        array.push(value);
    }
};