/**
 * Sample New York Times Events tag for Dust.
 *
 * @type {Function}
 */
exports = module.exports = function(app, dust, callback)
{
    var support = require("../support")(dust);
    var request = require("../../util/request");

    // helper functions
    var isDefined = support.isDefined;
    //var resolveVariables = support.resolveVariables;
    var map = support.map;
    var end = support.end;

    dust.helpers.nytEvents = function(chunk, context, bodies, params)
    {
        params = params || {};

        var latitude = dust.helpers.tap(params.latitude, chunk, context);
        var longitude = dust.helpers.tap(params.longitude, chunk, context);
        var radius = dust.helpers.tap(params.radius, chunk, context);
        if (!radius)
        {
            radius = 1000;
        }
        var text = dust.helpers.tap(params.text, chunk, context);
        var limit = dust.helpers.tap(params.limit, chunk, context);
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        var filter = dust.helpers.tap(params.filter, chunk, context)

        var filters = null;
        if (filter)
        {
            filter = filter.toLowerCase();
        }
        if (filter === "broadway")
        {
            filters = 'category:"Broadway"';
        }
        if (filter === "pick")
        {
            filters = "times_pick:true";
        }

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var API_KEY = "3d8d573ec0ae966ea57245357cfcf57f:1:70698955";

                var url = "http://api.nytimes.com/svc/events/v2/listings.json?api-key=" + API_KEY;
                if (latitude && longitude)
                {
                    var latLong = latitude + "," + longitude;
                    url += "&ll=" + latLong;
                    url += "&radius=" + radius;
                }

                if (text)
                {
                    url += "&query=" + text;
                }

                if (isDefined(limit))
                {
                    url += "&limit=" + limit;
                }

                if (filters)
                {
                    url += "&filters=" + filters;
                }

                //console.log("URL:" + url);

                request(url, function (error, response, json) {

                    if (error || response.status !== 200)
                    {
                        if (error) {
                            console.log("ERROR: " + error);
                        }

                        if (response.status !== 200) {
                            console.log("STATUS CODE: " + response.status);
                        }

                        chunk.write("There was an error loading this section");
                        end(chunk);

                        return;
                    }

                    console.log("BODY: " + JSON.stringify(json, null, "  "));

                    var resultObject = {
                        "rows": json.results
                    };
                    var newContext = context.push(resultObject);

                    chunk.render(bodies.block, newContext);
                    end(chunk, context);
                });
            });
        });
    };

    callback();
};
