var path = require('path');
var fs = require('fs');

exports = module.exports = function()
{
    var registry = {};

    var r = {};

    r.register = function(tagName, clazz)
    {
        registry[tagName] = clazz;
    };

    r.create = function(tagName, context, el)
    {
        var clazz = registry[tagName];

        return clazz(context, el);
    };

    return r;
};

