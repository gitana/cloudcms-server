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
    var resolveVariables = support.resolveVariables;
    var map = support.map;
    var end = support.end;
    var _MARK_INSIGHT = support._MARK_INSIGHT;

    // return value
    var r = {};

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
    r.handleQuery = function(chunk, context, bodies, params, keepOne)
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
        var locale = context.resolve(params.locale);

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            skip = parseInt(skip);
        }

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
            "role": role
        });

        var finishHandler = function(context, err)
        {
            tracker.finish(context);
        };

        // identifier for this fragment
        var fragmentId = context.resolve(params.fragment);

        return map(chunk, function(chunk) {

            // if we can serve this from the fragment cache, we do so
            support.serveFragment(context, chunk, fragmentId, requirements, function(err, disabled) {

                // if no error and fragments were not disabled, then asset was served back, so simply return
                if (!err && !disabled) {
                    return;
                }

                // not cached, so run this puppy...

                // TRACKER: START
                tracker.start(context, fragmentId, requirements);

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

                if (near)
                {
                    var nearArray = near.split(",");
                    nearArray[0] = parseFloat(nearArray[0]);
                    nearArray[1] = parseFloat(nearArray[1]);

                    query["loc"] = {
                        "$near" : {
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
                if (!isDefined(limit)) {
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
                req.branch(function(err, branch) {

                    if (err) {
                        return end(chunk, context);
                    }

                    var handleResults = function(array)
                    {
                        if (array.length > 0)
                        {
                            for (var i = 0; i < array.length; i++)
                            {
                                array[i]._statistics = array[i].__stats();
                            }
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

                            support.renderFragment(newContext, fragmentId, requirements, chunk, bodies, function(err) {
                                finishHandler(newContext, err);
                            });

                            //chunk.render(bodies.block, newContext);
                            //end(chunk, context);
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

                            //chunk.render(bodies.block, newContext);
                            //end(chunk, context);

                            support.renderFragment(newContext, fragmentId, requirements, chunk, bodies, function(err) {
                                finishHandler(newContext, err);
                            });
                        }
                    };

                    var doQuery = function(branch, query, pagination)
                    {
                        Chain(branch).queryNodes(query, pagination).then(function() {

                            _convertToArray(this, function(array) {
                                _filterWithAuthorityChecks(array, context, branch, role, function(array) {
                                    _enhanceQueryResults(array, function(array) {
                                        _trackQueryResults(array, context, function(array) {
                                            handleResults(array);
                                        });
                                    });
                                });
                            });

                        });
                    };

                    var doQueryPageHasContents = function(branch, query, pagination)
                    {
                        var page = context.get("helpers")["page"];

                        Chain(page).trap(function(err) {
                            console.log("ERR: " + JSON.stringify(err));
                        }).queryRelatives(query, {
                            "type": "wcm:page_has_content"
                        }, pagination).then(function() {

                            _convertToArray(this, function(array) {
                                _filterWithAuthorityChecks(array, context, branch, role, function(array) {
                                    _enhanceQueryResults(array, function(array) {
                                        _trackQueryResults(array, context, function(array) {
                                            handleResults(array);
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
        var locale = context.resolve(params.locale);

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
                    return end(chunk, context);
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

                branch.searchNodes(text, pagination).each(function() {

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

        // as
        var as = context.resolve(params.as);

        // node
        var nodeId = context.resolve(params.node);
        var associationType = context.resolve(params.type);
        var associationDirection = context.resolve(params.direction);

        // locale
        var locale = context.resolve(params.locale);

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

            if (locale)
            {
                var gitana = context.get("gitana");
                gitana.getDriver().setLocale(locale);
            }

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context);
                }

                branch.readNode(nodeId).then(function() {

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

                        var cf = function()
                        {
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
                        Chain(node.getBranch()).queryNodes({
                            "_doc": {
                                "$in": otherNodeIds
                            }
                        }, {
                            "limit": otherNodeIds.length
                        }).each(function() {

                            var associations_array = otherNodeIdToAssociations[this._doc];
                            for (var z = 0; z < associations_array.length; z++)
                            {
                                associations_array[z].other = JSON.parse(JSON.stringify(this));
                            }

                            // enhance node information
                            enhanceNode(this);

                            // TRACKER - PRODUCES "node"
                            tracker.produces(context, "node", this._doc);

                        }).then(function() {

                            cf();
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
        var locale = context.resolve(params.locale);

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
                    return end(chunk, context);
                }

                branch.readNode(fromNodeId).then(function() {

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

                    this.queryRelatives(query, config, pagination).then(function() {

                        _convertToArray(this, function(array) {
                            _filterWithAuthorityChecks(array, context, branch, role, function(array) {
                                _enhanceQueryResults(array, function(array) {
                                    _trackQueryResults(array, context, function(array) {
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
        var locale = context.resolve(params.locale);

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

        return map(chunk, function(chunk) {

            // if we can serve this from the fragment cache, we do so
            support.serveFragment(context, chunk, fragmentId, requirements, function(err, disabled) {

                // if no error and fragments were not disabled, then asset was served back, so simply return
                if (!err && !disabled) {
                    return;
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

                    support.renderFragment(newContext, fragmentId, requirements, chunk, bodies, function(err) {
                        finishHandler(newContext, err);
                    });

                    // chunk.render(bodies.block, newContext);
                    // end(chunk, context);
                };

                var req = context.get("req");
                req.branch(function(err, branch) {

                    if (err) {
                        return end(chunk, context);
                    }

                    // select by ID or select by Path
                    if (id)
                    {
                        branch.readNode(id).then(function() {
                            f(this);
                        });
                    }
                    else if (contentPath)
                    {
                        branch.readNode("root", contentPath).then(function() {
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

    var _handleForm = function(chunk, context, bodies, params)
    {
        params = params || {};

        var definition = context.resolve(params.definition);
        var form = context.resolve(params.form);
        var list = context.resolve(params.list);
        var successUrl = context.resolve(params.success);
        var errorUrl = context.resolve(params.error);

        return map(chunk, function(chunk) {

            var gitana = context.get("gitana");

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context);
                }

                // read the definition
                branch.readDefinition(definition).then(function() {
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
                        if (list)
                        {
                            var action = "/form/" + list + "?a=1";
                            if (successUrl)
                            {
                                action += "&successUrl=" + successUrl;
                            }
                            if (errorUrl)
                            {
                                action += "&errorUrl=" + errorUrl;
                            }
                            options.renderForm = true;
                            options.form = {
                                "attributes": {
                                    "method": "POST",
                                    "action": action,
                                    "enctype": "multipart/form-data",
                                    "data-ajax": "false"
                                },
                                "buttons": {
                                    "submit": {
                                        "value": "Submit"
                                    }
                                }
                            };
                        }

                        var divId = "form" + new Date().getTime();

                        chunk.write("<div id='" + divId + "'></div>");
                        chunk.write("<script>\r\n$('#" + divId + "').alpaca(" + JSON.stringify(config) + ");</script>\r\n");
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

        return map(chunk, function(chunk) {

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
                    var filePath = path.resolve(currentTemplateFilePaths[0], "..", "." + targetPath);

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
                                var filePath = path.resolve(currentTemplateFilePath, "..", targetPath);

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
                    end(chunk, context);
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
                        log("Error while rendering include for: " + templatePath);
                        log(err);
                    }

                    chunk.write(out);

                    end(chunk, context);
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
