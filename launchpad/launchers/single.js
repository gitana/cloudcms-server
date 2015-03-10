module.exports = function(options) {

    var factoryCallback = options.factory;
    var reportCallback = options.report;
    if (!reportCallback) {
        reportCallback = function () {
        };
    }
    var completionCallback = options.complete;
    if (!completionCallback) {
        completionCallback = function () {
        };
    }

    factoryCallback(function (server) {

        reportCallback();

        server.listen(server._listenPort);

        completionCallback();
    });
};
