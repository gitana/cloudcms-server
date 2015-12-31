var path = require('path');
var fs = require('fs');
var http = require('http');
var async = require("async");

var tracker = require("../tracker");

var util = require("../../util/util");

/**
 * Default dust tags for Cloud CMS.
 *
 * @type {Function}
 */
module.exports = function(app, dust, callback)
{
    var support = require("../support")(dust);

    var enhanceNode = util.enhanceNode;

    // helper functions
    var isDefined = support.isDefined;
    var resolveVariables = support.resolveVariables;
    var map = support.map;
    var end = support.end;
    var _MARK_INSIGHT = support._MARK_INSIGHT;

    /**
     * if
     *
     * It seems ridiculous to me that we should have to add this back in.  But it was deprecated in newer versions of
     * dust.js.  Logic is sound but frankly, I expect most of our users will want to use @if.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     * @returns {*}
     */
    dust.helpers.if = function( chunk, context, bodies, params ){
        var body = bodies.block,
            skip = bodies['else'];
        if( params && params.cond){
            var cond = params.cond;
            cond = context.resolve(cond);
            // eval expressions with given dust references
            if(eval(cond)){
                if(body) {
                    return chunk.render( bodies.block, context );
                }
                else {
                    _console.log( "Missing body block in the if helper!" );
                    return chunk;
                }
            }
            if(skip){
                return chunk.render( bodies['else'], context );
            }
        }
        // no condition
        else {
            _console.log( "No condition given in the if helper!" );
        }
        return chunk;
    };

    /**
     * iterates over keys of an object. Something that Dust apparently is not capable of.
     *
     * Syntax:
     *
     *    {@iter obj=jsonObject}
     *       type: {$key}
     *       value: {$value}
     *       type: {$type}
     *    {/iter}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.iter = function(chunk, context, bodies, params) {

        // TODO: there is already an @iterate helper defined in this helper file
        // TODO: do we need another?
        // TODO: {@iterate over=obj}{$key}-{$value} of type {$type}{~n}{/iterate}

        var obj = context.resolve(params.obj);

        var params2 = {};
        params2.over = obj;

        return dust.helpers.iterate(chunk, context, bodies, params2);
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
    var _handleQuery = function(chunk, context, bodies, params, keepOne)
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
                    limit = -1;
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

                    var handleResults = function()
                    {
                        var array = this.asArray();
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
                            if (this.totalRows() > 0)
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

                            //chunk.render(bodies.block, newContext);
                            //end(chunk, context);

                            support.renderFragment(newContext, fragmentId, requirements, chunk, bodies, function(err) {
                                finishHandler(newContext, err);
                            });
                        }
                    };

                    var doQuery = function(branch, query, pagination)
                    {
                        Chain(branch).queryNodes(query, pagination).each(function() {

                            // enhance node information
                            enhanceNode(this);

                            // TRACKER - PRODUCES "node"
                            tracker.produces(context, "node", this._doc);

                        }).then(function() {
                            handleResults.call(this);
                        });
                    };

                    var doQueryPageHasContents = function(branch, query, pagination)
                    {
                        var page = context.get("helpers")["page"];

                        Chain(page).trap(function(err) {
                            console.log("ERR: " + JSON.stringify(err));
                        }).queryRelatives(query, {
                            "type": "wcm:page_has_content"
                        }, pagination).each(function(){

                            // TRACKER - PRODUCES "node"
                            tracker.produces(context, "node", this._doc);

                        }).then(function() {
                            handleResults.call(this);
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
    var _handleSearch = function(chunk, context, bodies, params, keepOne)
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
                    limit = -1;
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

    var _handleAssociations = function(chunk, context, bodies, params)
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
                        limit = -1;
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

    var _handleRelatives = function(chunk, context, bodies, params)
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
                        limit = -1;
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

                    this.queryRelatives(query, config, pagination).each(function() {

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
        });
    };

    var _handleContent = function(chunk, context, bodies, params)
    {
        params = params || {};

        var id = context.resolve(params.id);
        var contentPath = context.resolve(params.path);

        // as
        var as = context.resolve(params.as);

        // locale
        var locale = context.resolve(params.locale);

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

            var f = function(node)
            {
                // enhance node information
                enhanceNode(node);

                // TRACKER - PRODUCES "node"
                tracker.produces(context, "node", this._doc);

                var newContextObject = {};
                if (as)
                {
                    newContextObject[as] = JSON.parse(JSON.stringify(node));

                    _MARK_INSIGHT(node, newContextObject[as].content);
                }
                else
                {
                    newContextObject["content"] = JSON.parse(JSON.stringify(node));

                    _MARK_INSIGHT(node, newContextObject.content);
                }

                var newContext = context.push(newContextObject);
                //newContext.get("content").attachments = attachments;
                chunk.render(bodies.block, newContext);
                end(chunk, context);
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
    var _handleInclude = function(chunk, context, bodies, params, targetPath)
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
                for (var k in params) {
                    var value = context.resolve(params[k]);
                    if (value) {
                        includeContextObject[k] = value;
                    }
                }
                // push down new file path
                var templateFilePaths = context.get("templateFilePaths");
                var newTemplateFilePaths = [];
                for (var r = 0; r < templateFilePaths.length; r++) {
                    newTemplateFilePaths.push(templateFilePaths[r]);
                }
                newTemplateFilePaths.push(filePath);
                includeContextObject["templateFilePaths"] = newTemplateFilePaths;
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

    /**
     * QUERY
     *
     * Queries for content from the content repository and renders.
     *
     * Syntax:
     *
     *    {@query sort="title" scope="page" type="custom:type" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/query}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.query = function(chunk, context, bodies, params)
    {
        return _handleQuery(chunk, context, bodies, params, false);
    };

    /**
     * QUERY AND KEEP ONE
     *
     * Queries for content from the content repository and renders.
     *
     * Syntax:
     *
     *    {@queryOne sort="title" scope="page" type="custom:type" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/queryOne}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.queryOne = function(chunk, context, bodies, params)
    {
        return _handleQuery(chunk, context, bodies, params, true);
    };

    /**
     * SEARCH
     *
     * Runs a search and passes the rows to a rendering template.
     *
     * Syntax:
     *
     *    {@search sort="title" scope="page" text="something" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/search}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.search = function(chunk, context, bodies, params)
    {
        return _handleSearch(chunk, context, bodies, params, false);
    };

    /**
     * SEARCH
     *
     * Runs a search and keeps one of the result items.  Passes the result to the rendering template.
     *
     * Syntax:
     *
     *    {@searchOne sort="title" scope="page" text="something" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/searchOne}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.searchOne = function(chunk, context, bodies, params)
    {
        return _handleSearch(chunk, context, bodies, params, true);
    };

    /**
     * ASSOCIATIONS
     *
     * Finds associations around a node.
     *
     * Syntax:
     *
     *    {@associations node="<nodeId>" type="<association_type>" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/associations}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.associations = function(chunk, context, bodies, params)
    {
        return _handleAssociations(chunk, context, bodies, params);
    };

    /**
     * RELATIVES
     *
     * Finds relatives around a node.
     *
     * Syntax:
     *
     *    {@relatives node="<nodeId>" type="<association_type>" limit="" skip="" as=""}
     *       {+templateIdentifier/}
     *    {/relatives}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.relatives = function(chunk, context, bodies, params)
    {
        return _handleRelatives(chunk, context, bodies, params);
    };

    /**
     * CONTENT
     *
     * Selects a single content item.
     *
     * Syntax:
     *
     *    {@content id="GUID" path="/a/b/c" as=""}
     *       {+templateIdentifier/}
     *    {/content}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.content = function(chunk, context, bodies, params) {
        return _handleContent(chunk, context, bodies, params);
    };

    /**
     * FORM
     *
     * Renders a form.
     *
     * Syntax:
     *
     *    {@form definition="custom:type" form="formKey" list="listKeyOrId" successUrl="" errorUrl=""}
     *       {+templateIdentifier/}
     *    {/form}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.form = function(chunk, context, bodies, params)
    {
        return _handleForm(chunk, context, bodies, params);
    };

    /**
     * INCLUDE TEMPLATE
     *
     * Includes another dust template into this one and passes any context forward.
     *
     * Syntax:
     *
     *    {@include path="../template.html" ...args/}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.include = function(chunk, context, bodies, params)
    {
        params = params || {};

        var targetPath = context.resolve(params.path);

        return _handleInclude(chunk, context, bodies, params, targetPath);
    };

    /**
     * INCLUDE BLOCK
     *
     * Includes a block dust template into this one and passes any context forward.
     *
     * Syntax:
     *
     *    {@block path="path" ...args/}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.block = function(chunk, context, bodies, params)
    {
        params = params || {};

        var targetPath = context.resolve(params.path);

        if (targetPath.indexOf("/blocks") === 0)
        {
            // we're ok
        }
        else
        {
            targetPath = "/" + path.join("blocks", targetPath);
        }

        return _handleInclude(chunk, context, bodies, params, targetPath);
    };

    /**
     * INCLUDE LAYOUT
     *
     * Includes a layout dust template into this one and passes any context forward.
     *
     * Syntax:
     *
     *    {@layout path="path" ...args/}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.layout = function(chunk, context, bodies, params)
    {
        params = params || {};

        var targetPath = context.resolve(params.path);

        if (targetPath.indexOf("/layouts") === 0)
        {
            // we're ok
        }
        else
        {
            targetPath = "/" + path.join("layouts", targetPath);
        }

        return _handleInclude(chunk, context, bodies, params, targetPath);
    };

    /**
     * BLOCK
     *
     * Declares a block.
     *
     * Syntax:
     *
     *    {@block name="abc"}
     *       ...default markup
     *    {/@block}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    /*
    dust.helpers.block = function(chunk, context, bodies, params)
    {
        params = params || {};

        var name = context.resolve(params.name);

        return chunk.capture(bodies.block, context, function(text, chunk) {

            var f = dust.load(name, chunk, context);
            var markup = "{+" + name + "}" + text + "{/" + name + "}";
            chunk.render(f, context)

            end(chunk, context);
        });
    };
    */



    /**
     * Allows parameters to be passed into blocks or partials
     */
    dust.helpers.params = function( chunk, context, bodies, params ){

        var partial = {};
        if( params)
        {
            for (var key in params)
            {
                partial[key] = params[key];
            }
        }

        // render
        var newContext = context.push(partial);

        //return bodies.block(chunk, dust.makeBase(partial))
        return bodies.block(chunk, newContext);
    };
    dust.helpers.parameters = dust.helpers.params;



    /**
     * Constructs a resource uri that is cache aware.
     *
     * Syntax:
     *
     *    {@resource uri="/images/logo.svg"/}
     *    {@res uri="/images/logo.svg"/}
     *    {@r uri="/images/logo.svg"/}
     *
     * Example:
     *
     *    <img src="{@resource uri="/images/logo.svg"/}">
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.r = dust.helpers.res = dust.helpers.resource = function(chunk, context, bodies, params)
    {
        params = params || {};

        var uri = context.resolve(params.uri);

        return map(chunk, function(chunk) {

            if (process.env.CLOUDCMS_APPSERVER_MODE === "production")
            {
                var req = context.get("req");
                if (req)
                {
                    var newUri = uri;

                    var cacheBuster = req.runtime.cb;

                    var i = uri.lastIndexOf(".");
                    if (i == -1)
                    {
                        newUri = uri + "." + cacheBuster;
                    }
                    else
                    {
                        newUri = uri.substring(0, i) + "-" + cacheBuster + uri.substring(i);
                    }

                    chunk.write(newUri);
                    end(chunk, context);
                }
                else
                {
                    chunk.write(uri);
                    end(chunk, context);
                }
            }
            else
            {
                chunk.write(uri);
                end(chunk, context);
            }
        });
    };

    /**
     * Shows debug information about the current context
     *
     * Syntax:
     *
     *    {@debug/}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.debug = function(chunk, context, bodies, params)
    {
        params = params || {};

        return map(chunk, function(chunk) {

            var json = JSON.stringify(context.stack.head, null, "  ");
            var html = "<textarea>" + json + "</textarea>"
            chunk.write(html);

            end(chunk, context);
        });
    };

    /**
     * Displays a value and allows for optional in-context editing.
     *
     * Syntax:
     *
     *    {@value node="_doc" property="propertyName"}
     *       {propertyValue}
     *    {/value}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.value = function(chunk, context, bodies, params)
    {
        params = params || {};

        var nodeId = context.resolve(params.node);
        var propertyId = context.resolve(params.property);

        return map(chunk, function(chunk) {

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context);
                }

                var repositoryId = branch.getRepositoryId();
                var branchId = branch.getId();

                var wrapperStart = "<div class='cloudcms-value' data-repository-id='" + repositoryId + "' data-branch-id='" + branchId + "' data-node-id='" + nodeId + "'";
                if (propertyId) {
                    wrapperStart += " data-property-id='" + propertyId + "'";
                }
                wrapperStart += ">";
                var wrapperEnd = "</div>";

                chunk.write(wrapperStart);
                chunk.render(bodies.block, context);
                chunk.write(wrapperEnd);

                end(chunk, context);

            });
        });
    };

    /**
     * Produces an anchor link.
     *
     * Syntax:
     *
     *    {@link [uri="uri"] [other token values]}
     *      Click me to go to the next page!
     *    {/link}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.link = function(chunk, context, bodies, params)
    {
        var classParam = context.resolve(params.class);

        // push tokens into context
        var tokens = context.get("request").tokens;
        context = context.push(tokens);

        // push params into context
        var paramsObject = {};
        for (var name in params)
        {
            if (name !== "uri")
            {
                paramsObject[name] = context.resolve(params[name]);
            }
        }
        context = context.push(paramsObject);

        // use uri from params or fallback to request uri
        var uri = context.resolve(params.uri);
        if (!uri)
        {
            uri = context.get("request").matchingPath;
        }

        return map(chunk, function(chunk) {

            // ensure uri is resolved
            resolveVariables([uri], context, function(err, results) {

                var uri = results[0];

                chunk.write("<a href='" + uri + "'");

                if (classParam)
                {
                    chunk.write(" class='" + classParam + "'");
                }

                chunk.write(">");
                chunk.render(bodies.block, context);
                chunk.write("</a>");

                end(chunk, context);

            });

        });
    };

    dust.helpers.nodeAttachmentValue = function(chunk, context, bodies, params)
    {
        params = params || {};

        var nodeId = context.resolve(params.node);
        var attachmentId = context.resolve(params.attachment);
        if (!attachmentId)
        {
            attachmentId = "default";
        }

        return map(chunk, function(chunk) {

            var req = context.get("req");
            req.branch(function(err, branch) {

                if (err) {
                    return end(chunk, context);
                }

                branch.readNode(nodeId).attachment(attachmentId).download(function(text) {

                    chunk.write(text);

                    end(chunk, context);
                });
            });
        });
    };

    dust.helpers.processTemplate = function(chunk, context, bodies, params)
    {
        params = params || {};

        var nodeId = context.resolve(params.node);
        var attachmentId = context.resolve(params.attachment);
        if (!attachmentId)
        {
            attachmentId = "default";
        }
        var propertyId = context.resolve(params.property);
        var locale = context.resolve(params.locale);

        return map(chunk, function(chunk) {

            if (locale)
            {
                var gitana = context.get("gitana");
                gitana.getDriver().setLocale(locale);
            }

            if (propertyId)
            {
                var req = context.get("req");
                req.branch(function(err, branch) {

                    if (err) {
                        return end(chunk, context);
                    }

                    branch.readNode(nodeId).then(function() {

                        resolveVariables([this[propertyId]], context, function (err, resolutions) {

                            chunk.write(resolutions[0]);

                            end(chunk, context);

                        });
                    });
                });
            }
            else
            {
                var req = context.get("req");
                req.branch(function(err, branch) {

                    if (err) {
                        return end(chunk, context);
                    }

                    branch.readNode(nodeId).attachment(attachmentId).download(function (text) {

                        resolveVariables([text], context, function (err, resolutions) {

                            chunk.write(resolutions[0]);

                            end(chunk, context);

                        });
                    });
                });
            }
        });
    };

    /**
     * Iterate helper, looks over a given object.
     *
     * Example:
     *    {@iterate over=obj}{$key}-{$value} of type {$type}{~n}{/iterate}
     *
     * @param key - object of the iteration - Mandatory parameter
     * @param sort - Optional. If omitted, no sort is done. Values allowed:
     *  sort="1" - sort ascending (per JavaScript array sort rules)
     *  sort="-1" - sort descending
     */
    dust.helpers.iterate = dust.helpers.it = function(chunk, context, bodies, params)
    {
        params = params || {};

        var over = context.resolve(params.over);
        if (!over) {
            console.log("Missing over");
            return chunk;
        }

        var sort = context.resolve(params.sort);
        if (typeof(sort) === "undefined") {
            sort = "asc";
        }

        var body = bodies.block;
        if (!body)
        {
            console.log('Missing body block in the iterate helper.');
            return chunk;
        }

        var asc = function(a, b) {
            return desc(a, b) * -1;
        };

        var desc = function(a, b) {
            if (a.sortable < b.sortable) {
                return 1;
            } else if (a.sortable > b.sortable) {
                return -1;
            }
            return 0;
        };

        var processBody = function(key, value) {
            return body(chunk, context.push({
                $key: key,
                $value: value,
                $type: typeof(value)
            }));
        };

        if (util.isObject(over) || util.isArray(over))
        {
            if (typeof(params.sort) !== "undefined")
            {
                // construct sort elements
                var elements = [];
                for (var k in over)
                {
                    if (over.hasOwnProperty(k))
                    {
                        var element = {};
                        element.key = k;
                        element.value = over[k];

                        if (util.isObject(over))
                        {
                            element.sortable = k;
                        }
                        else if (util.isArray(over))
                        {
                            element.sortable = over[k];
                        }

                        elements.push(element);
                    }
                }

                // run the sort
                if (sort === "-1" || sort === "desc")
                {
                    elements.sort(desc);
                }
                else if (sort === "1" || sort === "asc")
                {
                    elements.sort(asc);
                }

                // process in order
                for (var i = 0; i < elements.length; i++)
                {
                    chunk = processBody(elements[i].key, elements[i].value);
                }
            }
            else
            {
                // just do the natural order
                for (var k in over)
                {
                    if (over.hasOwnProperty(k))
                    {
                        chunk = processBody(k, over[k]);
                    }
                }
            }
        }

        return chunk;
    };

    var marked = require('marked');
    marked.setOptions({
        renderer: new marked.Renderer(),
        gfm: true,
        tables: true,
        breaks: false,
        pedantic: false,
        sanitize: true,
        smartLists: true,
        smartypants: false
    });

    /**
     * Renders markdown into the Dust template.
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     * @returns {*}
     */
    dust.helpers.markdown = function(chunk, context, bodies, params) {

        params = params || {};

        var text = context.resolve(params.text);
        if (!text) {
            return chunk;
        }

        text = marked(text);

        return chunk.write(text);
    };

    callback();

};
