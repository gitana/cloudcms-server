var TIMEOUT = 2500;

var handleInvalidations = function(items, callback) {

    if (items)
    {
        for (var i = 0; i < items.length; i++)
        {
            console.log(" " + items[i].operation + " -> " + items[i].type + ": " + items[i].id);

            if (items[i].operation === "invalidate_object")
            {
                // TODO: invalidate any cache dependent on object
            }
            else if (items[i].operation == "invalidate_application")
            {
                // TODO: invalidate any cache dependent on application
            }
        }
    }

    callback();
};

var runnerFn = function(provider)
{
    provider.process(function(err, items) {

        if (err)
        {
            console.log("ERR: " + err, err.stack);

            setTimeout(function() {
                runnerFn(provider);
            }, TIMEOUT);

            return;
        }

        if (items)
        {
            handleInvalidations(items, function () {

                setTimeout(function() {
                    runnerFn(provider);
                }, TIMEOUT);
            });
        }
        else
        {
            setTimeout(function() {
                runnerFn(provider);
            }, TIMEOUT);
        }
    });
};


module.exports = function()
{
    var r = {};

    r.start = function(callback) {

        var config = process.configuration;
        if (config && config["notifications"])
        {
            var notifications = config["notifications"];

            if (notifications.enabled)
            {
                var type = notifications.type;
                var configuration = notifications.configuration;

                var provider = require("./providers/" + type);
                provider.start(configuration, function(err) {

                    if (err)
                    {
                        callback(err);
                        return;
                    }

                    runnerFn(provider);

                    callback();
                });
            }
            else
            {
                callback();
            }
        }
        else
        {
            callback();
        }
    };

    return r;
}();
