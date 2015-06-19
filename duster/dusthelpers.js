var path = require('path');
var fs = require('fs');
var http = require('http');
var crypto = require('crypto');
var async = require("async");

var dependencyUtil = require("../util/dependencyUtil");

var util = require("../util/util");

/**
 * Populates Cloud CMS server helper methods into a dust instance.
 *
 * @type {Function}
 */
exports = module.exports = function(dust)
{
    var isDefined = function(thing)
    {
        return (typeof(thing) !== "undefined");
    };

    var resolveVariables = function(variables, context, callback)
    {
        if (!variables) {
            callback();
            return;
        }

        if (variables.length === 0)
        {
            callback(null, []);
            return;
        }

        async.map(variables, function(variable, callback) {

            dust.renderSource("" + variable, context, function (err, value) {

                if (err) {
                    callback(err);
                    return;
                }

                value = value.trim();

                callback(null, value);
            });

        }, function(err, results) {
            callback(err, results);
        });
    };

    /**
     * Helper function that sets the dust cursor to flushable.
     * This is to get around an apparent bug with dust:
     *
     *    https://github.com/linkedin/dustjs/issues/303
     *
     * @param chunk
     * @param callback
     * @returns {*}
     */
    var map = function(chunk, callback)
    {
        var cursor = chunk.map(function(branch) {
            callback(branch);
        });
        cursor.flushable = true;

        return cursor;
    };

    /**
     * Helper function to end the chunk.  This is in place because it's unclear exactly what is needed to counter
     * the issue mentioned in:
     *
     *    https://github.com/linkedin/dustjs/issues/303
     *
     * At one point, it seemed that some throttling of the end() call was required.  It may still be at some point.
     * So for now, we use this helper method to end() since it lets us inject our own behaviors if needed.
     *
     * @param chunk
     * @param context
     */
    var end = function(chunk, context)
    {
        chunk.end();
    };

    var _MARK_INSIGHT = function(node, result)
    {
        result.insightNode = node.getRepositoryId() + "/" + node.getBranchId() + "/" + node.getId();
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
        var type = dust.helpers.tap(params.type, chunk, context);

        // pagination
        var sort = dust.helpers.tap(params.sort, chunk, context);
        var sortDirection = dust.helpers.tap(params.sortDirection, chunk, context);
        var limit = dust.helpers.tap(params.limit, chunk, context);
        var skip = dust.helpers.tap(params.skip, chunk, context);

        // scope
        var scope = dust.helpers.tap(params.scope, chunk, context);

        // as
        var as = dust.helpers.tap(params.as, chunk, context);

        // single field constraints
        var field = dust.helpers.tap(params.field, chunk, context);
        var fieldRegex = dust.helpers.tap(params.fieldRegex, chunk, context);
        var fieldValue = dust.helpers.tap(params.fieldValue, chunk, context);

        // geolocation (near)
        var near = dust.helpers.tap(params.near, chunk, context);

        // locale
        var locale = dust.helpers.tap(params.locale, chunk, context);

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            limit = parseInt(skip);
        }

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {
                    console.log("ERROR: " + err);
                    end(chunk, context);
                };

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
                    gitana.getDriver().setLocale(locale);
                }

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

                    var branch = this;

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

                            chunk.render(bodies.block, newContext);
                            end(chunk, context);
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
                                resultObject = {};
                                resultObject[as] = {
                                    "rows": array,
                                    "offset": this.offset(),
                                    "total": this.totalRows()
                                };
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
                        }
                    };

                    var doQuery = function(branch, query, pagination)
                    {
                        Chain(branch).queryNodes(query, pagination).each(function() {

                            // DEPENDENCIES: TRACK
                            dependencyUtil.track(context, "_doc", this._doc);

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

                            // DEPENDENCIES: TRACK
                            dependencyUtil.track(context, "_doc", this._doc);

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
     * Searches for content and renders.
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
        params = params || {};

        // pagination
        var sort = dust.helpers.tap(params.sort, chunk, context);
        var sortDirection = dust.helpers.tap(params.sortDirection, chunk, context);
        var limit = dust.helpers.tap(params.limit, chunk, context);
        var skip = dust.helpers.tap(params.skip, chunk, context);

        // scope
        var scope = dust.helpers.tap(params.scope, chunk, context);

        // text
        var text = dust.helpers.tap(params.text, chunk, context);

        // as
        var as = dust.helpers.tap(params.as, chunk, context);

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            limit = parseInt(skip);
        }

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {
                    console.log("ERROR: " + err);
                    end(chunk, context);
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

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

                    this.searchNodes(text, pagination).then(function() {

                        var array = this.asArray();
                        for (var a = 0; a < array.length; a++)
                        {
                            _MARK_INSIGHT(array[a], array[a]);
                        }

                        var resultObject = null;
                        if (as)
                        {
                            resultObject = {};
                            resultObject[as] = {
                                "rows": array,
                                "offset": this.offset(),
                                "total": this.totalRows()
                            };
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
        params = params || {};

        // pagination
        var sort = dust.helpers.tap(params.sort, chunk, context);
        var sortDirection = dust.helpers.tap(params.sortDirection, chunk, context);
        var limit = dust.helpers.tap(params.limit, chunk, context);
        var skip = dust.helpers.tap(params.skip, chunk, context);

        // as
        var as = dust.helpers.tap(params.as, chunk, context);

        // node
        var nodeId = dust.helpers.tap(params.node, chunk, context);
        var associationType = dust.helpers.tap(params.type, chunk, context);
        var associationDirection = dust.helpers.tap(params.direction, chunk, context);

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            limit = parseInt(skip);
        }

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {
                    console.log("ERROR: " + err);
                    end(chunk, context);
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").readNode(nodeId).then(function() {

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

                    this.associations(config, pagination).then(function() {

                        var array = this.asArray();
                        for (var a = 0; a < array.length; a++)
                        {
                            _MARK_INSIGHT(array[a], array[a]);
                        }

                        var resultObject = null;
                        if (as)
                        {
                            resultObject = {};
                            resultObject[as] = {
                                "rows": array,
                                "offset": this.offset(),
                                "total": this.totalRows()
                            };
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
                            //console.log("R: " + JSON.stringify(resultObject, null, "  "));
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
                                associations_array[z].other = this;
                            }
                        }).then(function() {
                            cf();
                        });
                    });
                });

            });
        });
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
        params = params || {};

        // pagination
        var sort = dust.helpers.tap(params.sort, chunk, context);
        var sortDirection = dust.helpers.tap(params.sortDirection, chunk, context);
        var limit = dust.helpers.tap(params.limit, chunk, context);
        var skip = dust.helpers.tap(params.skip, chunk, context);

        // as
        var as = dust.helpers.tap(params.as, chunk, context);

        // from and type
        var fromNodeId = dust.helpers.tap(params.node, chunk, context);
        var associationType = dust.helpers.tap(params.associationType, chunk, context);
        var associationDirection = dust.helpers.tap(params.direction, chunk, context);

        var type = dust.helpers.tap(params.type, chunk, context);

        // single field constraints
        var field = dust.helpers.tap(params.field, chunk, context);
        var fieldRegex = dust.helpers.tap(params.fieldRegex, chunk, context);
        var fieldValue = dust.helpers.tap(params.fieldValue, chunk, context);

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            limit = parseInt(skip);
        }

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {
                    console.log("ERROR: " + err);
                    end(chunk, context);
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").readNode(fromNodeId).then(function() {

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

                    this.queryRelatives(query, config, pagination).then(function() {

                        var array = this.asArray();
                        for (var a = 0; a < array.length; a++)
                        {
                            _MARK_INSIGHT(array[a], array[a]);
                        }

                        var resultObject = null;
                        if (as)
                        {
                            resultObject = {};
                            resultObject[as] = {
                                "rows": array,
                                "offset": this.offset(),
                                "total": this.totalRows()
                            };
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
    dust.helpers.content = function(chunk, context, bodies, params)
    {
        params = params || {};

        var id = dust.helpers.tap(params.id, chunk, context);
        var contentPath = dust.helpers.tap(params.path, chunk, context);

        // as
        var as = dust.helpers.tap(params.as, chunk, context);

        // locale
        var locale = dust.helpers.tap(params.locale, chunk, context);

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                    end(chunk, context);
                };

                if (locale)
                {
                    gitana.getDriver().setLocale(locale);
                }

                var f = function(node)
                {
                    var newContextObject = null;
                    if (as)
                    {
                        newContextObject = {};
                        newContextObject[as] = {
                            "content": JSON.parse(JSON.stringify(node))
                        };

                        _MARK_INSIGHT(node, newContextObject[as].content);
                    }
                    else
                    {
                        newContextObject["content"] = JSON.parse(JSON.stringify(node));

                        _MARK_INSIGHT(node, newContextObject.content);
                    }

                    var newContext = context.push(newContextObject);

                    // add in attachments info
                    var attachments = {};
                    node.listAttachments().each(function() {
                        var id = this["_doc"];
                        attachments[id] = JSON.parse(JSON.stringify(this));
                        attachments[id]["url"] = "/static/node/" + node.getId() + "/attachments/" + id;
                        attachments[id]["preview32"] = "/static/node/" + node.getId() + "/preview/?attachment=" + id + "&size=32";
                        attachments[id]["preview64"] = "/static/node/" + node.getId() + "/preview/?attachment=" + id + "&size=64";
                        attachments[id]["preview128"] = "/static/node/" + node.getId() + "/preview/?attachment=" + id + "&size=128";
                        attachments[id]["preview256/"] = "/static/node/" + node.getId() + "/preview/?attachment=" + id + "&size=256";
                    }).then(function() {

                        newContext.content.attachments = attachments;

                        chunk.render(bodies.block, newContext);
                        end(chunk, context);
                    });
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

                    // select by ID or select by Path
                    if (id)
                    {
                        this.readNode(id).then(function() {
                            f(this);
                        });
                    }
                    else if (contentPath)
                    {
                        this.readNode("root", contentPath).then(function() {
                            f(this);
                        });
                    }
                    else
                    {
                        // missing both ID and Path?
                        console.log("Missing ID and PATH!");
                    }
                });

            });
        });
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
        params = params || {};

        var definition = dust.helpers.tap(params.definition, chunk, context);
        var form = dust.helpers.tap(params.form, chunk, context);
        var list = dust.helpers.tap(params.list, chunk, context);
        var successUrl = dust.helpers.tap(params.success, chunk, context);
        var errorUrl = dust.helpers.tap(params.error, chunk, context);

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                    end(chunk, context);
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

                    // read the definition
                    this.readDefinition(definition).then(function() {
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
        return map(chunk, function(chunk) {
            setTimeout(function() {

                var webStore = context.get("req").stores.web;

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

                        webStore.existsFile(filePath, function(exists) {

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

                                    webStore.existsFile(filePath, function(exists) {

                                        if (exists) {
                                            done(filePath);
                                        } else {
                                            done();
                                        }
                                    });
                                }
                            };
                            fns.push(fn);
                        }

                        async.series(fns, function(filePaths) {
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

                    // load the contents of the file
                    // make sure this is text
                    var compileTemplate = function(templatePath, callback) {

                        if (!dust.cache[templatePath])
                        {
                            webStore.readFile(filePath, function(err, data) {

                                var html = "" + data;

                                try
                                {
                                    // compile
                                    var compiledTemplate = dust.compile(html, templatePath);
                                    dust.loadSource(compiledTemplate);

                                    callback();
                                }
                                catch (e)
                                {
                                    // compilation failed
                                    console.log("Compilation failed for: " + filePath);
                                    console.log(e);

                                    callback(e);
                                }
                            });
                        }
                        else
                        {
                            callback();
                        }
                    };

                    compileTemplate(templatePath, function(err) {

                        if (err) {
                            console.log("Failed to compile template: " + err.message);
                            console.log(err);
                            end(chunk, context);
                        }

                        var includeContextObject = {};
                        for (var k in params) {
                            var value = dust.helpers.tap(params[k], chunk, context);
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

                            chunk.write(out);

                            end(chunk, context);
                        });
                    });
                });
            });
        });
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

        var targetPath = dust.helpers.tap(params.path, chunk, context);

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

        var targetPath = dust.helpers.tap(params.path, chunk, context);

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

        var targetPath = dust.helpers.tap(params.path, chunk, context);

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

        var name = dust.helpers.tap(params.name, chunk, context);

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

        var uri = dust.helpers.tap(params.uri, chunk, context);

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var webStore = context.get("req").stores.web;

                var newUri = uri;

                var req = context.get("req");
                if (req)
                {
                    var filename = uri;

                    // create md5 hash
                    var md5sum = crypto.createHash('md5');

                    // read file and update hash
                    webStore.readStream(filename, function(err, s) {

                        s.on('data', function (d) {
                            md5sum.update(d);
                        });
                        s.on('err', function (err) {
                            // something went wrong, couldn't read the file?
                            chunk.write(uri);
                            end(chunk, context);
                        });
                        s.on('end', function () {
                            var hash = md5sum.digest('hex');

                            var i = uri.lastIndexOf(".");
                            if (i == -1) {
                                newUri = uri + "." + hash;
                            }
                            else {
                                newUri = uri.substring(0, i) + "-" + hash + uri.substring(i);
                            }

                            chunk.write(newUri);
                            end(chunk, context);
                        });
                    });
                }
                else
                {
                    chunk.write(newUri);
                    end(chunk, context);
                }
            });
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
            setTimeout(function() {

                var json = JSON.stringify(context.stack.head, null, "  ");
                var html = "<textarea>" + json + "</textarea>"
                chunk.write(html);

                end(chunk, context);
            });
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

        var nodeId = dust.helpers.tap(params.node, chunk, context);
        var propertyId = dust.helpers.tap(params.property, chunk, context);

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                    end(chunk, context);
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

                    var repositoryId = this.getRepositoryId();
                    var branchId = this.getId();

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
        });
    };

    /**
     * Builds a URL.
     *
     * Syntax:
     *
     *    {@uri [uri="uri"] [other token values]}
     *    {/uri}
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    /*
    dust.helpers.uri = function(chunk, context, bodies, params)
    {
        // push tokens into context
        var tokens = context.get("request").tokens;
        context = context.push(tokens);

        // push params into context
        var paramsObject = {};
        for (var name in params)
        {
            if (name !== "uri")
            {
                paramsObject[name] = dust.helpers.tap(params[name], chunk, context);
            }
        }
        context = context.push(paramsObject);

        // use uri from params or fallback to request uri
        var uri = dust.helpers.tap(params.uri, chunk, context);
        if (!uri)
        {
            uri = context.get("request").matchingPath;
        }

        return map(chunk, function(chunk) {
            setTimeout(function() {

                // ensure uri is resolved
                resolveVariables([uri], context, function(err, results) {

                    var uri = results[0];

                    chunk.write(uri);

                    end(chunk, context);

                });

            });
        });
    };
    */

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
        var classParam = dust.helpers.tap(params.class, chunk, context);

        // push tokens into context
        var tokens = context.get("request").tokens;
        context = context.push(tokens);

        // push params into context
        var paramsObject = {};
        for (var name in params)
        {
            if (name !== "uri")
            {
                paramsObject[name] = dust.helpers.tap(params[name], chunk, context);
            }
        }
        context = context.push(paramsObject);

        // use uri from params or fallback to request uri
        var uri = dust.helpers.tap(params.uri, chunk, context);
        if (!uri)
        {
            uri = context.get("request").matchingPath;
        }

        return map(chunk, function(chunk) {
            setTimeout(function() {

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
        });
    };

    dust.helpers.nodeAttachmentValue = function(chunk, context, bodies, params)
    {
        params = params || {};

        var nodeId = dust.helpers.tap(params.node, chunk, context);
        var attachmentId = dust.helpers.tap(params.attachment, chunk, context);
        if (!attachmentId)
        {
            attachmentId = "default";
        }

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                    end(chunk, context);
                };

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").readNode(nodeId).attachment(attachmentId).download(function(text) {

                    chunk.write(text);

                    end(chunk, context);

                });
            });
        });
    };

    dust.helpers.processTemplate = function(chunk, context, bodies, params)
    {
        params = params || {};

        var nodeId = dust.helpers.tap(params.node, chunk, context);
        var attachmentId = dust.helpers.tap(params.attachment, chunk, context);
        if (!attachmentId)
        {
            attachmentId = "default";
        }
        var propertyId = dust.helpers.tap(params.property, chunk, context);
        var locale = dust.helpers.tap(params.locale, chunk, context);

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                    end(chunk, context);
                };

                if (locale)
                {
                    gitana.getDriver().setLocale(locale);
                }

                if (propertyId)
                {
                    Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").readNode(nodeId).then(function() {

                        resolveVariables([this[propertyId]], context, function (err, resolutions) {

                            chunk.write(resolutions[0]);

                            end(chunk, context);

                        });
                    });
                }
                else
                {
                    Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").readNode(nodeId).attachment(attachmentId).download(function (text) {

                        resolveVariables([text], context, function (err, resolutions) {

                            chunk.write(resolutions[0]);

                            end(chunk, context);

                        });
                    });
                }
            });
        });
    };

    dust.helpers.nytEvents = function(chunk, context, bodies, params)
    {
        params = params || {};

        var latitude = dust.helpers.tap(params.latitude, chunk, context);
        var longitude = dust.helpers.tap(params.longitude, chunk, context);
        var radius = dust.helpers.tap(params.radius, chunk, context);
        if (!radius)
        {
            radius = 1000;
        }
        var text = dust.helpers.tap(params.text, chunk, context);
        var limit = dust.helpers.tap(params.limit, chunk, context);
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        var filter = dust.helpers.tap(params.filter, chunk, context)

        var filters = null;
        if (filter)
        {
            filter = filter.toLowerCase();
        }
        if (filter === "broadway")
        {
            filters = 'category:"Broadway"';
        }
        if (filter === "pick")
        {
            filters = "times_pick:true";
        }

        return map(chunk, function(chunk) {
            setTimeout(function() {

                var request = require("request");
                var API_KEY = "3d8d573ec0ae966ea57245357cfcf57f:1:70698955";

                var url = "http://api.nytimes.com/svc/events/v2/listings.json?api-key=" + API_KEY;
                if (latitude && longitude)
                {
                    var latLong = latitude + "," + longitude;
                    url += "&ll=" + latLong;
                    url += "&radius=" + radius;
                }

                if (text)
                {
                    url += "&query=" + text;
                }

                if (isDefined(limit))
                {
                    url += "&limit=" + limit;
                }

                if (filters)
                {
                    url += "&filters=" + filters;
                }

                //console.log("URL:" + url);

                var request = require("request");
                request(url, function (error, response, body) {

                    if (error || response.statusCode !== 200)
                    {
                        if (error) {
                            console.log("ERROR: " + error);
                        }

                        if (response.statusCode !== 200) {
                            console.log("STATUS CODE: " + response.statusCode);
                        }

                        chunk.write("There was an error loading this section");
                        end(chunk);

                        return;
                    }

                    var json = JSON.parse(body);
                    console.log("BODY: " + JSON.stringify(json, null, "  "));

                    var resultObject = {
                        "rows": json.results
                    };
                    var newContext = context.push(resultObject);

                    chunk.render(bodies.block, newContext);
                    end(chunk, context);
                });
            });
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
    dust.helpers.iterate = dust.helpers.it = function (chunk, context, bodies, params)
    {
        params = params || {};

        var over = dust.helpers.tap(params.over, chunk, context);
        if (!over) {
            console.log("Missing over");
            return chunk;
        }

        var sort = dust.helpers.tap(params.sort, chunk, context);
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

};
