var path = require('path');
var fs = require('fs');
var http = require('http');
var async = require("async");

var tracker = require("../../tracker");
var util = require("../../../util/util");

var DEFAULT_PAGINATION_LIMIT = 25;

module.exports = function(app, dust)
{
    var support = require("../../support")(dust);

    var enhanceNode = util.enhanceNode;

    // helper functions
    var isDefined = support.isDefined;
    //var resolveVariables = support.resolveVariables;
    var map = support.map;
    var end = support.end;
    var _MARK_INSIGHT = support._MARK_INSIGHT;

    // return value
    var r = {};

    /**
     * Handles behavior for @expand
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     * @returns {*}
     * @private
     */
    r.handleExpand = function(chunk, context, bodies, params)
    {
        params = params || {};

        var key = context.resolve(params.key);
        var list = context.resolve(params.list);

        list = context.get(list) || [];

        if (!util.isArray(list)) {
            list = [list];
        }

        var idList = util.pluck(list, key);
        var finalIdList = [];
        for(var i = 0; i < idList.length; i++) {
            if (idList[i] && util.isString(idList[i])) {
                finalIdList.push(idList[i]);
            }
        }

        params._userQuery = {
            "_doc": {
                "$in": finalIdList
            }
        };
        params._orderResults = finalIdList;

        return handleQuery(chunk, context, bodies, params);
    };

    /**
     * Handles behavior for @query and @queryOne.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     * @param keepOne
     * @returns {*}
     * @private
     */
    var handleQuery = r.handleQuery = function(chunk, context, bodies, params, keepOne)
    {
        params = params || {};

        // type
        var type = context.resolve(params.type);

        // pagination
        var sort = context.resolve(params.sort);
        var sortDirection = context.resolve(params.sortDirection);
        var limit = context.resolve(params.limit);
        var skip = context.resolve(params.skip);

        // scope
        var scope = context.resolve(params.scope);

        // as
        var as = context.resolve(params.as);

        // single field constraints
        var field = context.resolve(params.field);
        var fieldRegex = context.resolve(params.fieldRegex);
        var fieldValue = context.resolve(params.fieldValue);

        // role
        var role = context.resolve(params.role);

        // geolocation (near)
        var near = context.resolve(params.near);

        // locale
        var locale = context.resolve(params.locale) || context.get("req").acceptLanguage;

        // whether to cache this fragment
        var cache = context.resolve(params.cache);
        if (typeof(cache) === "undefined" || !cache)
        {
            cache = false;
        }
        var fragmentId = null;
        if (cache) {
            fragmentId = context.get("fragmentIdGenerator")();
        }

        // user defined query
        var userQuery = params._userQuery;
        delete params._userQuery;
        if (!userQuery) {
            userQuery = {};
        }

        // order the resulting records by _doc using this array of IDs
        var orderResultsByList = params._orderResults;
        delete params._orderResults;

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            skip = parseInt(skip);
        }

        // DEBUG
        var forceError = context.resolve(params["forceError"]);

        var requirements = support.buildRequirements(context, {
            "type": type,
            "sort": sort,
            "sortDirection": sortDirection,
            "limit": limit,
            "skip": skip,
            "scope": scope,
            "as": as,
            "field": field,
            "fieldRegex": fieldRegex,
            "fieldValue": fieldValue,
            "near": near,
            "locale": locale,
            "role": role,
            "userQuery": JSON.stringify(userQuery)
        });

        var finishQueryHandler = function(context)
        {
            tracker.finish(context);
        };

        return map(chunk, function(chunk2) {

            // if we can serve this from the fragment cache, we do so
            support.loadFragment(context, fragmentId, requirements, function(err, fragmentText) {

                // if we found a fragment, stream it back
                if (!err && fragmentText)
                {
                    chunk2.write(fragmentText);
                    return chunk2.end();
                }

                // not cached, so run this puppy...

                // TRACKER: START
                tracker.start(context, fragmentId, requirements);

                var query = userQuery || {};
                if (isDefined(type))
                {
                    query._type = type;
                }
                if (isDefined(field))
                {
                    if (isDefined(fieldRegex))
                    {
                        query[field] = {
                            $regex: fieldRegex,
                            $options: "i"
                        };
                    }
                    else if (isDefined(fieldValue))
                    {
                        query[field] = fieldValue;
                    }
                }

                if (near)
                {
                    var nearArray = near.split(",");
                    nearArray[0] = parseFloat(nearArray[0]);
                    nearArray[1] = parseFloat(nearArray[1]);

                    query["loc"] = {
                        "$near": {
                            "lat": nearArray[0],
                            "long": nearArray[1]
                        }
                    };
                }

                // strip out translations
                query["_features.f:translation"] = {
                    "$exists": false
                };

                var pagination = {};
                if (!isDefined(limit))
                {
                    limit = DEFAULT_PAGINATION_LIMIT;
                }
                pagination.limit = limit;
                if (isDefined(sort))
                {
                    if (typeof(sortDirection) !== "undefined")
                    {
                        sortDirection = parseInt(sortDirection, 10);
                    }
                    else
                    {
                        sortDirection = 1;
                    }

                    pagination.sort = {};
                    pagination.sort[sort] = sortDirection;
                }
                if (isDefined(skip))
                {
                    pagination.skip = skip;
                }

                if (locale)
                {
                    var gitana = context.get("gitana");
                    gitana.getDriver().setLocale(locale);
                }

                var req = context.get("req");
                req.branch(function (err, branch) {

                    // DEBUG: force error
                    if (forceError)
                    {
                        console.log("FORCE ERROR");
                        err = {
                            "message": "Force error"
                        };
                    }

                    if (err)
                    {
                        return end(chunk2, context, err);
                    }

                    var handleQueryResults = function (array) {
                        if (array.length > 0)
                        {
                            for (var i = 0; i < array.length; i++)
                            {
                                array[i]._statistics = array[i].__stats();
                            }
                        }

                        if (orderResultsByList && util.isArray(orderResultsByList))
                        {
                            var newArray = [];
                            for (var i = 0; i < orderResultsByList.length; i++)
                            {
                                for (var j = 0; j < array.length; j++)
                                {
                                    if (array[j]._doc == orderResultsByList[i])
                                    {
                                        newArray.push(array[j]);
                                        continue;
                                    }
                                }
                            }
                            array = newArray;
                        }

                        if (keepOne)
                        {
                            var newContext = null;
                            if (array.length > 0)
                            {
                                var result = array[0];

                                var resultObject = null;
                                if (as)
                                {
                                    resultObject = {};
                                    resultObject[as] = JSON.parse(JSON.stringify(result));

                                    _MARK_INSIGHT(result, resultObject[as]);
                                }
                                else
                                {
                                    resultObject = JSON.parse(JSON.stringify(result));

                                    _MARK_INSIGHT(result, resultObject);
                                }

                                newContext = context.push(resultObject);
                            }
                            else
                            {
                                newContext = context.push({});
                            }

                            support.renderFragment(newContext, fragmentId, requirements, chunk2, bodies, function (err) {

                                if (err)
                                {
                                    console.log("Caught error in handleQuery/renderFragment: " + err);
                                    return end(chunk2, newContext, err);
                                }

                                finishQueryHandler(newContext);
                            });
                        }
                        else
                        {
                            for (var a = 0; a < array.length; a++)
                            {
                                _MARK_INSIGHT(array[a], array[a]);
                            }

                            var resultObject = null;
                            if (as)
                            {
                                resultObject = {
                                    "offset": array._offset,
                                    "total": array._totalRows
                                };
                                resultObject[as] = array;
                            }
                            else
                            {
                                resultObject = {
                                    "rows": array,
                                    "offset": array._offset,
                                    "total": array._totalRows
                                };
                            }

                            var newContext = context.push(resultObject);

                            support.renderFragment(newContext, fragmentId, requirements, chunk2, bodies, function (err) {

                                if (err)
                                {
                                    console.log("Caught error in handleQuery/renderFragment: " + err);
                                    return end(chunk2, newContext, err);
                                }

                                finishQueryHandler(newContext);
                            });
                        }
                    };

                    var doQuery = function (branch, query, pagination) {
                        Chain(branch).trap(function (err) {
                            console.log("Caught error in handleQuery: " + err);
                            end(chunk2, context, err);
                            return false;
                        }).queryNodes(query, pagination).then(function () {

                            _convertToArray(this, function (array) {
                                _filterWithAuthorityChecks(array, context, branch, role, function (array) {
                                    _enhanceQueryResults(array, function (array) {
                                        _trackQueryResults(array, context, function (array) {
                                            handleQueryResults(array);
                                        });
                                    });
                                });
                            });

                        });
                    };

                    var doQueryPageHasContents = function (branch, query, pagination) {
                        var page = context.get("helpers")["page"];

                        Chain(page).trap(function (err) {
                            console.log("Caught error in handleQuery: " + err);
                            end(chunk2, context, err);
                            return false;
                        }).queryRelatives(query, {
                            "type": "wcm:page_has_content"
                        }, pagination).then(function () {

                            _convertToArray(this, function (array) {
                                _filterWithAuthorityChecks(array, context, branch, role, function (array) {
                                    _enhanceQueryResults(array, function (array) {
                                        _trackQueryResults(array, context, function (array) {
                                            handleQueryResults(array);
                                        });
                                    });
                                });
                            });

                        });
                    };

                    if (isDefined(scope))
                    {
                        doQueryPageHasContents(branch, query, pagination);
                    }
                    else
                    {
                        doQuery(branch, query, pagination);
                    }

                });
            });
        });
    };

    /**
     * Handles behavior for @search and @searchOne.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     * @param keepOne
     * @returns {*}
     * @private
     */
    r.handleSearch = function(chunk, context, bodies, params, keepOne)
    {
        params = params || {};

        // pagination
        var sort = context.resolve(params.sort);
        var sortDirection = context.resolve(params.sortDirection);
        var limit = context.resolve(params.limit);
        var skip = context.resolve(params.skip);

        // scope
        //var scope = context.resolve(params.scope);

        // text
        var text = context.resolve(params.text);

        // as
        var as = context.resolve(params.as);

        // locale
        var locale = context.resolve(params.locale) || context.get("req").acceptLanguage;

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            limit = parseInt(skip);
        }

        // TRACKER: START
        context = tracker.start(context);

        if (locale) {
            tracker.requires(context, "locale", locale);
        }

        return map(chunk, function(chunk) {

            if (locale)
            {
                var gitana = context.get("gitana");
                gitana.getDriver().setLocale(locale);
            }

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context, err);
                }

                // TODO: use a "find" to limit to a range of nodes (for page scope)?

                var pagination = {};
                if (!isDefined(limit)) {
                    limit = DEFAULT_PAGINATION_LIMIT;
                }
                pagination.limit = limit;
                if (sort)
                {
                    if (typeof(sortDirection) !== "undefined")
                    {
                        sortDirection = parseInt(sortDirection, 10);
                    }
                    else
                    {
                        sortDirection = 1;
                    }

                    pagination.sort = {};
                    pagination.sort[sort] = sortDirection;
                }
                if (skip)
                {
                    pagination.skip = skip;
                }

                Chain(branch).trap(function(err){
                    console.log("Caught error in handleSearch: " + err);
                    end(chunk, context, err);
                    return false;
                }).searchNodes(text, pagination).each(function() {

                    // enhance node information
                    enhanceNode(this);

                    // TRACKER - PRODUCES "node"
                    tracker.produces(context, "node", this._doc);

                }).then(function() {

                    var array = this.asArray();
                    for (var a = 0; a < array.length; a++)
                    {
                        _MARK_INSIGHT(array[a], array[a]);
                    }

                    var resultObject = null;
                    if (as)
                    {
                        resultObject = {
                            "offset": this.offset(),
                            "total": this.totalRows()
                        };
                        resultObject[as] = array;
                    }
                    else
                    {
                        resultObject = {
                            "rows": array,
                            "offset": this.offset(),
                            "total": this.totalRows()
                        };
                    }

                    var newContext = context.push(resultObject);

                    chunk.render(bodies.block, newContext);
                    end(chunk, context);
                });
            });
        });
    };

    r.handleAssociations = function(chunk, context, bodies, params)
    {
        params = params || {};

        // pagination
        var sort = context.resolve(params.sort);
        var sortDirection = context.resolve(params.sortDirection);
        var limit = context.resolve(params.limit);
        var skip = context.resolve(params.skip);
        var nodeSort = context.resolve(params.nodeSort);
        var nodeSortDirection = context.resolve(params.nodeSortDirection);
        var nodeSkip = context.resolve(params.nodeSkip);
        var nodeLimit = context.resolve(params.nodeLimit);

        // as
        var as = context.resolve(params.as);

        // node
        var nodeId = context.resolve(params.node);
        var associationType = context.resolve(params.type);
        var associationDirection = context.resolve(params.direction);

        // locale
        var locale = context.resolve(params.locale) || context.get("req").acceptLanguage;

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            skip = parseInt(skip);
        }
        if (isDefined(nodeLimit))
        {
            nodeLimit = parseInt(nodeLimit);
        }
        if (isDefined(nodeSkip))
        {
            nodeSkip = parseInt(nodeSkip);
        }

        // TRACKER: START
        tracker.start(context);
        if (locale) {
            tracker.requires(context, "locale", locale);
        }

        return map(chunk, function(chunk) {

            if (locale)
            {
                var gitana = context.get("gitana");
                gitana.getDriver().setLocale(locale);
            }

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context, err);
                }

                Chain(branch).trap(function(err) {
                    console.log("Caught error in handleAssociations: " + err);
                    end(chunk, context, err);
                    return false;
                }).readNode(nodeId).then(function() {

                    var pagination = {};
                    if (!isDefined(limit)) {
                        limit = DEFAULT_PAGINATION_LIMIT;
                    }
                    pagination.limit = limit;
                    if (sort)
                    {
                        if (typeof(sortDirection) !== "undefined")
                        {
                            sortDirection = parseInt(sortDirection, 10);
                        }
                        else
                        {
                            sortDirection = 1;
                        }

                        pagination.sort = {};
                        pagination.sort[sort] = sortDirection;
                    }
                    if (skip)
                    {
                        pagination.skip = skip;
                    }

                    var config = {};
                    if (associationType)
                    {
                        config.type = associationType;
                    }
                    if (associationDirection)
                    {
                        config.direction = associationDirection;
                    }

                    var node = this;

                    this.associations(config, pagination).each(function() {

                        // TRACKER - PRODUCES "node"
                        tracker.produces(context, "node", this._doc);

                    }).then(function() {

                        var array = this.asArray();
                        for (var a = 0; a < array.length; a++)
                        {
                            _MARK_INSIGHT(array[a], array[a]);
                        }

                        var resultObject = null;
                        if (as)
                        {
                            resultObject = {
                                "offset": this.offset(),
                                "total": this.totalRows()
                            };
                            resultObject[as] = array;
                        }
                        else
                        {
                            resultObject = {
                                "rows": array,
                                "offset": this.offset(),
                                "total": this.totalRows()
                            };
                        }

                        var cf = function(sortedArray)
                        {
                            if (sortedArray) {
                                resultObject[as || "rows"] = sortedArray;
                                resultObject.total = sortedArray.length;
                            }
                            var newContext = context.push(resultObject);

                            chunk.render(bodies.block, newContext);
                            end(chunk, context);
                        };

                        if (array.length == 0)
                        {
                            cf();
                            return;
                        }

                        // load target node data for each association
                        var otherNodeIdsMap = {};
                        var otherNodeIds = [];
                        var otherNodeIdToAssociations = {};
                        for (var z = 0; z < array.length; z++)
                        {
                            var otherNodeId = null;
                            if (array[z].source == node._doc) {
                                otherNodeId = array[z].target;
                            } else {
                                otherNodeId = array[z].source;
                            }

                            if (!otherNodeIdsMap[otherNodeId])
                            {
                                otherNodeIdsMap[otherNodeId] = true;
                                otherNodeIds.push(otherNodeId);
                            }

                            if (!otherNodeIdToAssociations[otherNodeId])
                            {
                                otherNodeIdToAssociations[otherNodeId] = [];
                            }

                            otherNodeIdToAssociations[otherNodeId].push(array[z]);
                        }

                        pagination = {
                            limit: nodeLimit || otherNodeIds.length,
                            skip: nodeSkip || 0
                        };
                        if (nodeSort)
                        {
                            if (typeof(nodeSortDirection) !== "undefined")
                            {
                                sortDirection = parseInt(nodeSortDirection, 10);
                            }
                            else
                            {
                                sortDirection = 1;
                            }

                            pagination.sort = {};
                            pagination.sort[nodeSort] = sortDirection;
                        }
                        var otherNodeIdToAssociationsSorted = [];
                        Chain(node.getBranch()).queryNodes({
                            "_doc": {
                                "$in": otherNodeIds
                            }
                        }, pagination).each(function() {

                            var associations_array = otherNodeIdToAssociations[this._doc];
                            for (var z = 0; z < associations_array.length; z++)
                            {
                                associations_array[z].other = JSON.parse(JSON.stringify(this));

                                // sorting by node properties (not association properties)
                                otherNodeIdToAssociationsSorted.push(associations_array[z]);
                            }

                            // enhance node information
                            enhanceNode(this);

                            // TRACKER - PRODUCES "node"
                            tracker.produces(context, "node", this._doc);

                        }).then(function() {
                            if (pagination.sort) {
                                cf(otherNodeIdToAssociationsSorted);
                            }
                            else{
                                cf();
                            }
                        });
                    });
                });
            });
        });
    };

    r.handleRelatives = function(chunk, context, bodies, params)
    {
        params = params || {};

        // pagination
        var sort = context.resolve(params.sort);
        var sortDirection = context.resolve(params.sortDirection);
        var limit = context.resolve(params.limit);
        var skip = context.resolve(params.skip);

        // as
        var as = context.resolve(params.as);

        // from and type
        var fromNodeId = context.resolve(params.node);
        var associationType = context.resolve(params.associationType);
        var associationDirection = context.resolve(params.direction);

        var type = context.resolve(params.type);

        // single field constraints
        var field = context.resolve(params.field);
        var fieldRegex = context.resolve(params.fieldRegex);
        var fieldValue = context.resolve(params.fieldValue);

        // locale
        var locale = context.resolve(params.locale) || context.get("req").acceptLanguage;

        // role
        var role = context.resolve(params.role);

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            limit = parseInt(skip);
        }

        // TRACKER: START
        tracker.start(context);
        if (locale) {
            tracker.requires(context, "locale", locale);
        }

        return map(chunk, function(chunk) {

            var gitana = context.get("gitana");

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context, err);
                }

                Chain(branch).trap(function(err){
                    console.log("Caught error in handleRelatives: " + err);
                    end(chunk, context, err);
                    return false;
                }).readNode(fromNodeId).then(function() {

                    // first query for relatives
                    var query = {};
                    if (isDefined(type))
                    {
                        query._type = type;
                    }
                    if (isDefined(field))
                    {
                        if (isDefined(fieldRegex))
                        {
                            query[field] = {
                                $regex: fieldRegex,
                                $options: "i"
                            };
                        }
                        else if (isDefined(fieldValue))
                        {
                            query[field] = fieldValue;
                        }
                    }

                    // pagination
                    var pagination = {};
                    if (!isDefined(limit)) {
                        limit = DEFAULT_PAGINATION_LIMIT;
                    }
                    pagination.limit = limit;
                    if (sort)
                    {
                        if (typeof(sortDirection) !== "undefined")
                        {
                            sortDirection = parseInt(sortDirection, 10);
                        }
                        else
                        {
                            sortDirection = 1;
                        }

                        pagination.sort = {};
                        pagination.sort[sort] = sortDirection;
                    }
                    if (skip)
                    {
                        pagination.skip = skip;
                    }

                    var config = {};
                    if (associationType)
                    {
                        config.type = associationType;
                    }
                    if (associationDirection)
                    {
                        config.direction = associationDirection;
                    }

                    var handleResults = function(array) {

                        for (var a = 0; a < array.length; a++)
                        {
                            _MARK_INSIGHT(array[a], array[a]);
                        }

                        var resultObject = null;
                        if (as)
                        {
                            resultObject = {
                                "offset": array._offset,
                                "total": array._totalRows
                            };
                            resultObject[as] = array;
                        }
                        else
                        {
                            resultObject = {
                                "rows": array,
                                "offset": array._offset,
                                "total": array._totalRows
                            };
                        }

                        var newContext = context.push(resultObject);

                        chunk.render(bodies.block, newContext);
                        end(chunk, context);

                    };

                    Chain(this).trap(function(err) {
                        console.log("Caught error in handleRelatives/queryRelatives: " + err);
                        end(chunk, context, err);
                        return false;
                    }).queryRelatives(query, config, pagination).then(function () {

                        _convertToArray(this, function (array) {
                            _filterWithAuthorityChecks(array, context, branch, role, function (array) {
                                _enhanceQueryResults(array, function (array) {
                                    _trackQueryResults(array, context, function (array) {
                                        handleResults(array);
                                    });
                                });
                            });
                        });

                    });
                });
            });
        });
    };

    r.handleContent = function(chunk, context, bodies, params)
    {
        params = params || {};

        var id = context.resolve(params.id);
        var contentPath = context.resolve(params.path);

        // as
        var as = context.resolve(params.as);

        // locale
        var locale = context.resolve(params.locale) || context.get("req").acceptLanguage;

        var requirements = support.buildRequirements(context, {
            "as": as,
            "id": id,
            "contentPath": contentPath,
            "locale": locale
        });

        var finishHandler = function(context, err)
        {
            tracker.finish(context);
        };

        // identifier for this fragment
        var fragmentId = context.resolve(params.fragment);

        return map(chunk, function(chunk2) {

            // if we can serve this from the fragment cache, we do so
            support.loadFragment(context, fragmentId, requirements, function(err, fragmentText) {

                // if we found a fragment, stream it back
                if (!err && fragmentText) {
                    chunk2.write(fragmentText);
                    return chunk2.end();
                }

                // TRACKER: START
                tracker.start(context);
                if (locale) {
                    tracker.requires(context, "locale", locale);
                }

                if (locale)
                {
                    var gitana = context.get("gitana");
                    gitana.getDriver().setLocale(locale);
                }

                var f = function(node)
                {
                    // enhance node information
                    enhanceNode(node);

                    // TRACKER - PRODUCES "node"
                    tracker.produces(context, "node", node._doc);

                    var newContextObject = {};
                    if (as)
                    {
                        newContextObject[as] = JSON.parse(JSON.stringify(node));

                        _MARK_INSIGHT(node, newContextObject[as]);
                    }
                    else
                    {
                        newContextObject["content"] = JSON.parse(JSON.stringify(node));

                        _MARK_INSIGHT(node, newContextObject.content);
                    }

                    var newContext = context.push(newContextObject);
                    //newContext.get("content").attachments = attachments;

                    support.renderFragment(newContext, fragmentId, requirements, chunk2, bodies, function(err) {
                        finishHandler(newContext, err);
                    });

                    // chunk.render(bodies.block, newContext);
                    // end(chunk, context);
                };

                var req = context.get("req");
                req.branch(function(err, branch) {

                    if (err) {
                        return end(chunk2, context, err);
                    }

                    // select by ID or select by Path
                    if (id)
                    {
                        Chain(branch).trap(function(err) {
                            console.log("Caught error in handleContent: " + err);
                            end(chunk2, context, err);
                            return false;
                        }).readNode(id).then(function() {
                            f(this);
                        });
                    }
                    else if (contentPath)
                    {
                        Chain(branch).trap(function(err) {
                            console.log("Caught error in handleContent: " + err);
                            end(chunk2, context, err);
                            return false;
                        }).readNode("root", contentPath).then(function() {
                            f(this);
                        });
                    }
                    else
                    {
                        // missing both ID and Path?
                        console.log("Missing ID and PATH! {@content} helper must have either a path or an id");
                    }
                });
            });
        });
    };

    r.handleForm = function(chunk, context, bodies, params)
    {
        params = params || {};

        var definition = context.resolve(params.definition);
        var form = context.resolve(params.form);
        var list = context.resolve(params.list);
        var successUrl = context.resolve(params.success);
        var errorUrl = context.resolve(params.error);
        var formId = context.resolve(params.formId);
        
        return map(chunk, function(chunk) {

            var gitana = context.get("gitana");

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context, err);
                }

                // read the definition
                Chain(branch).trap(function(err) {
                    console.log("Caught error in handleForm: " + err);
                    end(chunk, context, err);
                    return false;
                }).readDefinition(definition).then(function() {
                    var schema = this;

                    // if a form is specified, read the form
                    var options = null;
                    this.readForm(form).then(function() {
                        options = this;
                    });

                    this.then(function() {

                        if (!options)
                        {
                            options = {};
                        }

                        var config = {
                            "schema": schema,
                            "options": options
                        };
                        var action = "/_form/submit";
                        /*
                         if (list)
                         {
                         action += "&list=" + list;
                         }
                         if (successUrl)
                         {
                         action += "&successUrl=" + successUrl;
                         }
                         if (errorUrl)
                         {
                         action += "&errorUrl=" + errorUrl;
                         }
                         */
                        /*
                         options.renderForm = true;
                         options.form = {
                         "attributes": {
                         "method": "POST",
                         "action": action,
                         "enctype": "application/json",
                         "data-ajax": "true"
                         },
                         "buttons": {
                         "submit": {
                         "title": "Submit"
                         }
                         }
                         };
                         */
                        config.helper = {};
                        config.helper.method = "POST";
                        config.helper.action = action;
                        if (list)
                        {
                            config.helper.list = list;
                        }
                        if (successUrl)
                        {
                            config.helper.successUrl = successUrl;
                        }
                        if (errorUrl)
                        {
                            config.helper.errorUrl = errorUrl;
                        }

                        config.connector = {
                            "id": "appserver",
                            "config": {}
                        };

                        var divId = formId || "form" + new Date().getTime();

                        chunk.write("<div id='" + divId + "'></div>");
                        chunk.write("<script src='/_lib/formhelper/formhelper.js'></script>");

                        chunk.write("<script>");
                        chunk.write("var formConfig = GenerateForm(" + JSON.stringify(config) + ");");
                        chunk.write("$('#" + divId + "').alpaca(formConfig);");
                        chunk.write("</script>");

                        end(chunk, context);

                    });
                });
            });
        });
    };

    // NOTE: this can also be done like this:
    // NOTE: as per source dust.js line 521
    /*
     Context.prototype.resolve = function(body) {
     var chunk;

     if(typeof body !== 'function') {
     return body;
     }
     chunk = new Chunk().render(body, this);
     if(chunk instanceof Chunk) {
     return chunk.data.join(''); // ie7 perf
     }
     return chunk;
     };
     */

    /**
     * Handles include behavior for @include and @module
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     * @param targetPath
     * @returns {*}
     * @private
     */
    r.handleInclude = function(chunk, context, bodies, params, targetPath)
    {
        params = params || {};

        var log = context.options.log;

        targetPath = targetPath.replace(/\\/g, '/');

        return map(chunk, function(chunk2) {

            var store = context.options.store;

            // the stack of executing template file paths
            var currentTemplateFilePaths = context.get("templateFilePaths").reverse();

            var resolveMatchingFilePath = function(callback)
            {
                // absolute path
                if (targetPath.indexOf("/") === 0)
                {
                    currentTemplateFilePaths = currentTemplateFilePaths.reverse();

                    // absolute path, always relative to the first element in the template file paths list
                    var filePath = path.normalize(path.join(currentTemplateFilePaths[0], "..", "." + targetPath));

                    // if the file path does not end with ".html", we append
                    if (filePath.indexOf(".html") == -1)
                    {
                        filePath += ".html";
                    }

                    store.existsFile(filePath, function(exists) {

                        if (exists) {
                            callback(null, filePath);
                        } else {
                            callback();
                            // callback({"message": "file not found in store: " + filePath});
                        }
                    });
                }
                else
                {
                    var fns = [];

                    // relative path, walk the template file paths list backwards
                    var filePaths = [];
                    for (var a = 0; a < currentTemplateFilePaths.length; a++)
                    {
                        var fn = function(currentTemplateFilePath) {
                            return function(done) {

                                // target template path
                                var filePath = path.normalize(path.join(currentTemplateFilePath, "..", targetPath));

                                // if the file path does not end with ".html", we append
                                if (filePath.indexOf(".html") == -1)
                                {
                                    filePath += ".html";
                                }

                                store.existsFile(filePath, function(exists) {

                                    if (exists) {
                                        filePaths.push(filePath);
                                    }

                                    done();
                                });
                            }
                        };
                        fns.push(fn);
                    }

                    async.series(fns, function() {

                        for (var i = 0; i < filePaths.length; i++) {
                            if (filePaths[i]) {
                                callback(null, filePaths[i]);
                                break;
                            }
                        }
                    })

                }
            };

            resolveMatchingFilePath(function(err, matchingFilePath) {

                // if no match...
                if (!matchingFilePath) {
                    console.log("Unable to find included file for path: " + targetPath);
                    end(chunk2, context);
                    return;
                }

                var filePath = matchingFilePath;

                var templatePath = filePath.split(path.sep).join("/");

                var includeContextObject = {};

                // override with any params
                for (var k in params) {
                    var value = context.resolve(params[k]);
                    if (value) {
                        includeContextObject[k] = value;
                    }
                }

                // some additional overrides that we enforce
                var templateFilePaths = context.get("templateFilePaths");
                var newTemplateFilePaths = [];
                for (var r = 0; r < templateFilePaths.length; r++) {
                    newTemplateFilePaths.push(templateFilePaths[r]);
                }
                newTemplateFilePaths.push(filePath);
                includeContextObject["templateFilePaths"] = newTemplateFilePaths;

                // include the subcontext
                var subContext = context.push(includeContextObject);

                dust.render(templatePath, subContext, function (err, out) {

                    if (err) {
                        log("Error while rendering include for: " + templatePath + ", err: " + (err && err.message ? err.message : err));
                        return end(chunk2, subContext, err);
                    }

                    chunk2.write(out);
                    end(chunk2, subContext);
                });
            });
        });
    };

    /**
     * Handles behavior for @fragment.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     *
     * @returns {*}
     * @private
     */
    var handleFragment = r.handleFragment = function(chunk, context, bodies, params)
    {
        params = params || {};

        var fragmentId = context.get("fragmentIdGenerator")();

        var requirements = support.buildRequirements(context, {});

        var finishHandler = function(context, err)
        {
            tracker.finish(context);
        };

        return map(chunk, function(chunk2) {

            // if we can serve this from the fragment cache, we do so
            support.loadFragment(context, fragmentId, requirements, function(err, fragmentText) {

                // if we found a fragment, stream it back
                if (!err && fragmentText) {
                    chunk2.write(fragmentText);
                    return chunk2.end();
                }

                // not cached, so run this puppy...

                // TRACKER: START
                tracker.start(context, fragmentId, requirements);

                var requirements = support.buildRequirements(context, {});

                var newContext = context.push({});

                support.renderFragment(newContext, fragmentId, requirements, chunk2, bodies, function(err) {
                    finishHandler(newContext, err);
                });

            });
        });
    };

    r.util = util;
    r.map = support.map;
    r.end = support.end;
    r.resolveVariables = support.resolveVariables;


    // pipeline

    var _convertToArray = function(map, _done)
    {
        var array = [];

        for (var i = 0; i < map.__keys().length; i++)
        {
            array.push(map[map.__keys()[i]]);
        }

        // additional values
        array._totalRows = map.totalRows();
        array._offset = map.offset();

        _done(array);
    };

    var _filterWithAuthorityChecks = function(array, context, branch, role, _done)
    {
        if (!role) {
            return _done(array);
        }

        var req = context.get("req");
        if (!req) {
            return _done(array);
        }

        var user = req.user;
        if (!user) {
            return _done(array);
        }
        if (!user.domainId || !user.id) {
            return _done(array);
        }

        var principalId = user.domainId + "/" + user.id;

        // filter via authority checks
        var checks = [];
        for (var i = 0; i < array.length; i++)
        {
            checks.push({
                "permissionedId": array[i]._doc,
                "authorityId": role,
                "principalId": principalId
            });
        }

        Chain(branch).checkNodeAuthorities(checks, function(results) {

            // create a quick lookup map
            var resultsMap = {};
            for (var i = 0; i < results.length; i++)
            {
                resultsMap[results[i].permissionedId] = results[i].result;
            }

            // now filter the array
            var i = 0;
            do
            {
                if (i < array.length)
                {
                    var permissionedId = array[i]._doc;

                    if (resultsMap[permissionedId])
                    {
                        i++;
                    }
                    else
                    {
                        array.splice(i, 1);
                    }
                }
            }
            while (i < array.length);

            _done(array);
        });
    };

    var _enhanceQueryResults = function(array, _done)
    {
        for (var i = 0; i < array.length; i++)
        {
            // enhance node information
            enhanceNode(array[i]);
        }

        _done(array);
    };

    var _trackQueryResults = function(array, context, _done)
    {
        for (var i = 0; i < array.length; i++)
        {
            // TRACKER - PRODUCES "node"
            tracker.produces(context, "node", array[i]._doc);
        }

        _done(array);
    };

    return r;
};