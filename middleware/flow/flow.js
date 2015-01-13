/*

 Cloud CMS Flow middleware

 Endpoints:

 - GET /_flows/:flowId
 returns the requested flow

 - GET /_flows/:flowId/states/:stateId
 returns the requested state

 */

exports = module.exports = function ()
{
    // Given the req and res objects and a route test to see if the route matches
    // if it does call it and return true.
    var testRoute = function (req, res, route) {
        if (req.method === route[0] && route[1].test(req.path)) {
            req.matches = req.path.match(route[1]);
            route[2](req, res);
            return true;
        } else {
            return false;
        }
    };

    // given a flow id get the corresponding flow and call the callback
    var getFlow = function (req, id, cb) {
        req.branch(function(err, branch) {
            Chain(branch).queryOne({_type: 'web:flow', _doc: id}).then(function () {
                cb.bind(this)(this);
            });
        });
    };

    var r = {};

    r.handlers = function () {

        //////////////////////////////////////////////////////////////////////////
        // Routes
        //
        // Routes are arrays with 3 elements,
        // - the request method
        // - a regular expression
        // - a callback
        //
        // If the request has the correct method and the path matches the regex
        // then the callback will be called.
        //
        // Before it's called the matches will be added to the request object.
        //////////////////////////////////////////////////////////////////////////

        var routes = [];

        // Gets the flow associated with the given id
        var flow = ['GET', /^\/_flows\/([^\/]+)\/?$/, function (req, res) {
            var flowId = req.matches[1];
            getFlow(req, flowId, function () {
                var flow = this;
                var properties = flow.properties;
                properties.states = undefined;
                properties.url = '/_flows/{{ flowId }}/states/{{ stateId }}';
                flow.set('properties', properties);
                flow.set('type', 'remote');
                res.json(flow);
            });
        }];
        routes.push(flow);

        // Gets the state associated with the given id
        var state = ['POST', /^\/_flows\/([^\/]+)\/states\/(.+)\/?$/, function (req, res) {
            var flowId = req.matches[1];
            var stateId = req.matches[2];
            getFlow(req, flowId, function () {
                var flow = this;
                var state = flow.get('properties').states[stateId];
                res.json(state);
            });
        }];
        routes.push(state);

        // the middleware
        return function (req, res, next) {

            // if workspaces is not enabled then just go to next
            if (!req.isEnabled("workspace"))
            {
                next();
                return;
            }

            // get branch
            req.branch(function(err, branch) {

                req.gitana.trap(function (err) {
                    res.json(err);
                });

                var found = false;
                for (var i = routes.length - 1; i >= 0 && !found; i--)
                {
                    found = testRoute(req, res, routes[i]);
                }

                if (!found) {
                    next();
                }
            })
        };
    };

    return r;

}();
