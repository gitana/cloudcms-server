var path = require('path');
var fs = require('fs');
var util = require("util");
var cheerio = require("cheerio");

exports = module.exports = function()
{
    var tags = {};

    var r = {};

    /**
     * Sets a tag.
     *
     * @param id
     * @param resource
     */
    r.setTag = function(id, tag)
    {
        tags[id] = tag;
    };

    r.getTag = function(id)
    {
        return tags[id];
    };

    return r;
};

