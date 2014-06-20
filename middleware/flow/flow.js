/*

  Cloud CMS Flow middleware

  Endpoints:

  - GET /_flows/:flowId
    returns the requested flow

  - GET /_flows/:flowId/states/:stateId
    returns the requested state

*/

exports = module.exports = function(basePath) {

  var r = {};

  r.handlers = function(config) {

    // used to cache the master branch and route definitions
    var branch = false;
    var routes = [];

    // determines if workspaces are enabled
    var enabled = (function() {
      return !!(config.workspace && config.workspace.enabled);
    })();

    if (enabled) {

      // Given the req and res objects and a route test to see if the route matches
      // if it does call it and return true.
      var testRoute = function(req, res, route) {
        if (req.method === route[0] && route[1].test(req.path)) {
          req.matches = req.path.match(route[1]);
          route[2](req, res);
          return true;
        } else {
          return false;
        }
      };

      var nodeExists = function(q, yes, no) {
        branch.queryNodes(q).count(function(count) {
          if (count > 0) {
            yes();
          } else {
            no();
          }
        });
      };

      // The opposite of nodeExists
      var nodeDoesNotExist = function(q, yes, no) {
        nodeExists(q, no, yes);
      };

      // Creates a node if it does not exist or updates it if it does
      var createOrUpdate = function(q, data, cb) {
        nodeExists(q,function() {
          branch.queryOne(q).then(function() {
            var node = this;
            for (var i in data) {
              node.set(i, data[i]);
            }
            node.update().then(cb);
          });
        }, function() {
          branch.createNode(data).then(cb);
        });
      };

      // given a flow id get the corresponding flow and call the callback
      var getFlow = function(id, cb) {
        branch.queryOne({ _type: 'web:flow', _doc: id }).then(function() {
          cb.bind(this)(this);
        });
      };

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

      // Gets the flow associated with the given id
      var flow = ['GET', /^\/_flows\/([^\/]+)\/?$/, function(req, res) {
        var flowId = req.matches[1];
        getFlow(flowId, function() {
          var flow          = this;
          var properties    = flow.properties;
          properties.states = undefined;
          properties.url    = '/_flows/{{ flowId }}/states/{{ stateId }}';
          flow.set('properties', properties);
          flow.set('type', 'remote');
          res.json(flow);
        });
      }];
      routes.push(flow);

      // Gets the state associated with the given id
      var state = ['POST', /^\/_flows\/([^\/]+)\/states\/(.+)\/?$/, function(req, res) {
        var flowId  = req.matches[1];
        var stateId = req.matches[2];
        getFlow(flowId, function() {
          var flow  = this;
          var state = flow.get('properties').states[stateId];
          res.json(state);
        });
      }];
      routes.push(state);

    } // if enabled

    // Call the matching route or next if none match
    var handler = function(req, res, next) {
      req.gitana.trap(function(err) {
        res.json(err);
      });

      var found = false;
      for (var i = routes.length - 1; i >= 0 && !found; i--) {
        var route = routes[i];
        found = testRoute(req, res, route);
      }

      if (!found) {
        next();
      }
    };

    // the middleware
    return function(req, res, next) {

      // if workspaces is not enabled then just go to next
      if (!enabled) {
        next();
        return;
      }

      // if branch is not cached then get it, cache it, and call handler
      // otherwise just call handler
      if (!branch) {
        req.gitana.datastore('content').then(function() {
          this.readBranch('master').then(function() {
            branch = this;
            handler(req, res, next);
          });
        });
      } else {
        handler(req, res, next);
      }

    };

  };

  return r;

};
