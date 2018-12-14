var util = require("../../util/util");
var proxyFactory = require("../../util/proxy-factory");

/**
 * GraphQL middleware.
 *
 * @type {Function}
 */
exports = module.exports = function()
{
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // RESULTING OBJECT
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var r = {};

    /**
     * Intercepts and rewrites graphql calls to /proxy.
     *
     * If a call comes in as /graphql/schema, it gets rewritten to:
     *
     *   /proxy/repositories/{repositoryId}/branches/{branchId}/graphql/schema
     *
     * @return {Function}
     */
    r.interceptor = function()
    {
        return util.createInterceptor("graphql", function(req, res, next, stores, cache, configuration) {

            var allowAnonymousConnection = (configuration && configuration.config && configuration.config.anonymous) ? true : false;

            var useProxy = false;

            if (req.url && req.url.indexOf("/graphql") === 0)
            {
                useProxy = true;
            }

            if (useProxy)
            {
                return req.branch(function(err, branch) {

                    var pathPrefix = "/repositories/" + branch.getRepositoryId() + "/branches/" + branch.getId();

                    // do we have an authenticated user?
                    if (req.gitana_user) {
                        req.gitana_proxy_access_token = req.gitana_user.getDriver().http.accessToken();
                    }

                    // should we allow "anonymous" query using appuser?\
                    if (req.gitana && !req.gitana_proxy_access_token && allowAnonymousConnection) {
                        req.gitana_proxy_access_token = req.gitana.getDriver().http.accessToken();
                    }

                    // acquire the proxy handler
                    var proxyTarget = req.gitanaConfig.baseURL;
                    proxyFactory.acquireProxyHandler(proxyTarget, pathPrefix, function(err, proxyHandler) {

                        if (err) {
                            return next(err);
                        }

                        proxyHandler(req, res);
                    });
                });
            }

            next();
        });
    };

    return r;
}();

