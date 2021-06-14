exports = module.exports = {};

var util = require("../../../util/util");
var socketUtil = require("../../../util/socket");

var subscriptionsBound = false;

var bindSubscriptions = function()
{
    if (subscriptionsBound) {
        return;
    }

    subscriptionsBound = true;

    // LISTEN: "deployment_synced"
    process.broadcast.subscribe("deployment_synced", function (message, channel, done) {

        if (!done) {
            done = function () {};
        }

        var deployment = message.deployment;

        var resources = deployment.resources;
        for (var k in resources)
        {
            var resourceObject = resources[k]; // state, operation, reference, headReference

            var reference = resourceObject.reference;
            var headReference = resourceObject.headReference;

            var deploymentObject = JSON.parse(JSON.stringify(deployment));
            delete deploymentObject.reference;
            delete deploymentObject.headReference;
            delete deploymentObject.resources;
            delete deploymentObject.targetSummaries;

            var watchObject = {
                "type": "deployment_synced",
                "resource": resourceObject,
                "deployment": deploymentObject
            };

            // fire to reference
            process.IO.to(reference).emit("watchResource", reference, watchObject);

            // fire to head reference
            process.IO.to(headReference).emit("watchResource", headReference, watchObject);
        }

        done();
    });
};

exports.bindSocket = function(socket, provider)
{
    bindSubscriptions();

    socketUtil.bindGitana(socket, function() {

        socket.on("watchResource", function(reference, callback) {

            if (reference)
            {
                // join room for this reference
                //console.log("watchResource, room: " + reference);
                socket.join(reference);
            }

            callback();
        });
    });
};
