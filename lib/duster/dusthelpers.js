var path = require('path');
var fs = require('fs');
var http = require('http');
var util = require("util");

var mkdirp = require('mkdirp');

var Gitana = require('gitana');

exports = module.exports = function(dust)
{
    var isDefined = function(thing)
    {
        return (typeof(thing) != "undefined");
    };

    /*
    dust.helpers.partial = function(chunk, context, bodies, params)
    {
        var partial_context = {};
        // optional : context fo server processed partial related data
        var p_context = context.get("partial");

        if (p_context || params)
        {
            // add to the partial context
        }

        return bodies.block( chunk, dust.makeBase(partial_context));
    };
    */

    var _handleQuery = function(chunk, context, bodies, params, keepOne)
    {
        params = params || {};

        // type
        var type = dust.helpers.tap(params.type, chunk, context);

        // pagination
        var sort = dust.helpers.tap(params.sort, chunk, context);
        var limit = dust.helpers.tap(params.limit, chunk, context);
        var skip = dust.helpers.tap(params.skip, chunk, context);

        // scope
        var scope = dust.helpers.tap(params.scope, chunk, context);

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            limit = parseInt(skip);
        }

        return chunk.map(function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {
                    console.log("ERROR: " + err);
                    chunk.end("");
                };

                var query = {};
                if (isDefined(type))
                {
                    query._type = type;
                }

                var pagination = {};
                if (!isDefined(limit)) {
                    limit = -1;
                }
                pagination.limit = limit;
                if (isDefined(sort))
                {
                    pagination.sort = {};
                    pagination.sort[sort] = 1;
                }
                if (isDefined(skip))
                {
                    pagination.skip = skip;
                }

                Chain(gitana.datastore("content")).trap(errHandler).readBranch("master").then(function() {

                    var branch = this;

                    var doQuery = function(branch, query, pagination)
                    {
                        if (keepOne)
                        {
                            Chain(branch).queryNodes(query, pagination).then(function() {

                                var newContext = null;
                                if (this.totalRows() > 0)
                                {
                                    var result = this.asArray()[0];
                                    newContext = JSON.parse(JSON.stringify(result));
                                }

                                chunk.render(bodies.block, dust.makeBase(newContext));
                                chunk.end("");
                            });
                        }
                        else
                        {
                            Chain(branch).queryNodes(query, pagination).then(function() {

                                var newContext = {};
                                //newContext.user = context.user;

                                var source = {
                                    "rows": this.asArray(),
                                    "offset": this.offset(),
                                    "total": this.totalRows()
                                };

                                newContext.rows = source.rows;
                                newContext.offset = source.offset;
                                newContext.total = source.total;

                                chunk.render(bodies.block, dust.makeBase(newContext));
                                chunk.end("");
                            });
                        }
                    };

                    if (isDefined(scope))
                    {
                        var page = context.get("helpers")["page"];

                        var processPageItems = function()
                        {
                            var docFields = [];
                            for (var i = 0; i < page.items.length; i++)
                            {
                                docFields.push(page.items[i]._doc);
                            }
                            query["_doc"] = {"$in": docFields};
                            doQuery(branch, query, pagination);
                        };

                        if (!page.items)
                        {
                            page.items = [];
                            Chain(page).trap(function(err) {
                                console.log("ERR: " + JSON.stringify(err));
                            }).listRelatives({
                                "type": "wcm:page_has_content"
                            }, {
                                "limit": 99999
                            }).each(function() {
                                page.items.push(this);
                            }).then(function() {
                                processPageItems();
                            });
                        }
                        else
                        {
                            processPageItems();
                        }
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
     *    {@query sort="title" scope="page" type="custom:type" limit="" skip=""}
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
     *    {@queryOne sort="title" scope="page" type="custom:type" limit="" skip=""}
     *       {+templateIdentifier/}
     *    {/query}
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
     *    {@search sort="title" scope="page" text="something" limit="" skip=""}
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
        var limit = dust.helpers.tap(params.limit, chunk, context);
        var skip = dust.helpers.tap(params.skip, chunk, context);

        // scope
        var scope = dust.helpers.tap(params.scope, chunk, context);

        // text
        var text = dust.helpers.tap(params.text, chunk, context);

        // ensure limit and skip are numerical
        if (isDefined(limit))
        {
            limit = parseInt(limit);
        }
        if (isDefined(skip))
        {
            limit = parseInt(skip);
        }

        return chunk.map(function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                    chunk.end("");
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
                        pagination.sort = {};
                        pagination.sort[sort] = 1;
                    }
                    if (skip)
                    {
                        pagination.skip = skip;
                    }

                    this.searchNodes(text, pagination).then(function() {

                        var source = {
                            "rows": this.asArray(),
                            "offset": this.offset(),
                            "total": this.totalRows()
                        };

                        var newContext = {};
                        newContext.user = context.user;
                        newContext.rows = source.rows;
                        newContext.offset = source.offset;
                        newContext.total = source.total;

                        chunk.render(bodies.block, dust.makeBase(newContext));
                        chunk.end("");
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
     *    {@content id="GUID" path="/a/b/c"}
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

        return chunk.map(function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                    chunk.end("");
                };

                var f = function(node)
                {
                    var newContext = {};
                    newContext.user = context.user;
                    newContext.content = JSON.parse(JSON.stringify(node));

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

                        chunk.render(bodies.block, dust.makeBase(newContext));
                        chunk.end("");

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

        return chunk.map(function(chunk) {
            setTimeout(function() {

                var gitana = context.get("gitana");

                var errHandler = function(err) {

                    console.log("ERROR: " + err);
                    chunk.end("");
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
                            chunk.end("");
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
     *    {@includeTemplate ...args}
     *       {>"../folder/included-template.html"}
     *    {/includeTemplate>
     *
     * @param chunk
     * @param context
     * @param bodies
     * @param params
     */
    dust.helpers.includeTemplate = function(chunk, context, bodies, params)
    {
        params = params || {};

        var targetPath = dust.helpers.tap(params.path, chunk, context);

        return chunk.map(function(chunk) {
            setTimeout(function() {

                // the request
                var req = context.get("req");

                // currently executing template path
                var currentTemplateFilePath = context.get("templateFilePath");
                //console.log("Current Template File Path: " + currentTemplateFilePath);

                // target template path
                var filePath = path.resolve(currentTemplateFilePath, "..", targetPath);
                //console.log("Target Template File Path: " + filePath);

                // if the file path does not end with ".html", we append
                if (filePath.indexOf(".html") == -1)
                {
                    filePath += ".html";
                }

                if (!fs.existsSync(filePath))
                {
                    console.log("Missing template for file path: " + filePath);
                    chunk.end();
                    return;
                }

                var templatePath = req.applicationId + "_" + filePath.split(path.sep).join("/");
                //console.log("Template Path: " + templatePath);

                // load the contents of the file
                // make sure this is text
                var compiled = false;
                if (!dust.cache[templatePath])
                {
                    var html = "" + fs.readFileSync(filePath);

                    try
                    {
                        // compile
                        var compiledTemplate = dust.compile(html, templatePath);
                        dust.loadSource(compiledTemplate);

                        compiled = true;
                    }
                    catch (e)
                    {
                        // compilation failed
                        console.log("Compilation failed for: " + filePath);
                        console.log(e);
                    }
                }
                else
                {
                    compiled = true;
                }

                // now run the template
                if (compiled)
                {
                    var includeContextObject = {};
                    for (var k in params) {
                        includeContextObject[k] = params[k];
                    }
                    var subContext = context.push(includeContextObject);

                    dust.render(templatePath, subContext, function(err, out) {

                        chunk.write(out);
                        chunk.end();
                    });
                }
                else
                {
                    chunk.end();
                }

            });
        });
    };
};
