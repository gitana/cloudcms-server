/**
 * @iter
 *
 * @param app
 * @param dust
 * @param callback
 */
module.exports = function(app, dust, callback)
{
    var engine = require("../engine")(app, dust);
    var util = engine.util;
    var map = engine.map;
    var end = engine.end;

    /**
     * Iterate helper, looks over a given object.
     *
     * Example:
     *    {@iterate over=obj}{$key}-{$value} of type {$type}{~n}{/iterate}
     *
     * @param key - object of the iteration - Mandatory parameter
     * @param sort - Optional. If omitted, no sort is done. Values allowed:
     *  sort="1" - sort ascending (per JavaScript array sort rules)
     *  sort="-1" - sort descending
     */
    dust.helpers.iterate = dust.helpers.it = function(chunk, context, bodies, params)
    {
        params = params || {};

        var over = context.resolve(params.over);
        if (!over) {
            console.log("Missing over");
            return chunk;
        }

        var sort = context.resolve(params.sort);
        if (typeof(sort) === "undefined") {
            sort = "asc";
        }

        var body = bodies.block;
        if (!body)
        {
            console.log('Missing body block in the iterate helper.');
            return chunk;
        }

        var asc = function(a, b) {
            return desc(a, b) * -1;
        };

        var desc = function(a, b) {
            if (a.sortable < b.sortable) {
                return 1;
            } else if (a.sortable > b.sortable) {
                return -1;
            }
            return 0;
        };

        var processBody = function(key, value) {
            return body(chunk, context.push({
                $key: key,
                $value: value,
                $type: typeof(value)
            }));
        };

        if (util.isObject(over) || util.isArray(over))
        {
            if (typeof(params.sort) !== "undefined")
            {
                // construct sort elements
                var elements = [];
                for (var k in over)
                {
                    if (over.hasOwnProperty(k))
                    {
                        var element = {};
                        element.key = k;
                        element.value = over[k];

                        if (util.isObject(over))
                        {
                            element.sortable = k;
                        }
                        else if (util.isArray(over))
                        {
                            element.sortable = over[k];
                        }

                        elements.push(element);
                    }
                }

                // run the sort
                if (sort === "-1" || sort === "desc")
                {
                    elements.sort(desc);
                }
                else if (sort === "1" || sort === "asc")
                {
                    elements.sort(asc);
                }

                // process in order
                for (var i = 0; i < elements.length; i++)
                {
                    chunk = processBody(elements[i].key, elements[i].value);
                }
            }
            else
            {
                // just do the natural order
                for (var k in over)
                {
                    if (over.hasOwnProperty(k))
                    {
                        chunk = processBody(k, over[k]);
                    }
                }
            }
        }

        return chunk;
    };

    callback();
};
