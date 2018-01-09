var memored = require("../../temp/memored");
var clusterlock = require("../../temp/clusterlock");

// use sticky-session library
var sticky = require('sticky-session');

module.exports = function(options) {

    var factoryCallback = options.factory;
    var reportCallback = options.report;
    if (!reportCallback)
    {
        reportCallback = function () {
        };
    }
    var completionCallback = options.complete;
    if (!completionCallback)
    {
        completionCallback = function () {
        };
    }

    factoryCallback(function (server) {

        if (!sticky.listen(server, server._listenPort))
        {
            // master code

            // start up shared memory
            memored.setup({purgeInterval: 500});

            // start up cluster locks
            clusterlock.setup();

            // wait 5 seconds, then fire callbacks
            setTimeout(function () {
                reportCallback();
                completionCallback();
            }, 5000);
        }
        else
        {
            // worker code
        }

    });
};