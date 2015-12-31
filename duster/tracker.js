var exports = module.exports;

var util = require("../util/util");

var trackerInstance = function(context)
{
    return context.get("__tracker");
};

var getParentContext = function(context)
{
    var parentContext = null;

    // if this context has a parent...
    if (context.stack && context.stack.tail && context.stack.tail.length > 0)
    {
        // the current tip context
        // pop it off and "context" modifies
        var currentContext = context.pop();

        // the new tip is the parent
        parentContext = context.current();

        // restore the current context as tip
        context.push(currentContext);
    }

    return parentContext;
};

var id = exports.id = function(context)
{
    var instance = trackerInstance(context);

    return instance.id;
};

/**
 * Starts a tracker within the current context.
 *
 * The tracker is bound to the Dust context's push and pop methods.  A "__tracker" instance holds the dependency
 * tracker instance for that particular frame in the stack.
 *
 * When the context is popped, the tracker for the current frame copies some of it's dependency state from the child
 * to the parent.  Dependency state is either of type "produces" or "requires".
 *
 * PRODUCES
 * --------
 *
 * The "produces" dependencies usually identify the content items or display assets that the current execution
 * rendered on the screen.  It identifies which objects produced the rendered view.
 *
 * When the context pops, these dependencies always copy from the child context to the parent.  Any wrapping fragments
 * inherit the produced dependencies of their children, all the way up to the page.
 *
 * That way, if a product dependency (i.e. a Cloud CMS content node) invalidates, all pages and nested fragments can be
 * detected and invalidated at once.
 *
 * In this sense, it is fair to think of produced dependencies as serving the purpose of how to optimize
 * invalidation.
 *
 * REQUIRES
 * --------
 *
 * The "requires" dependencies identify the required state of the parent such that the cached state of the
 * current execution context can be used.
 *
 * These dependencies are a list of "what must be true" about the outer variables such that we can use the cache
 * fragment.
 *
 * All requires variables are local.  They do not propagate up to the parent in the same way as "produces" dependencies.
 * Rather, the nested nature of HTML ensures that outer HTML fragments will contain the HTML of inner HTML fragments.
 *
 * The "requires" dependencies serve as a kind of footprint that allows for a very fast pattern match against the
 * current set of known runtime variables at any point in the execution chain.  For the top-level page, these include
 * things like the repository ID, the branchID and any other request state that was used to produce the page.
 *
 * All "requires" dependencies pass down to children but they do not pass back up to parents.
 *
 *
 * Requirements should look like:
 *
 *      {
 *          "param1": "abc",
 *          "param2": "def"
 *      }
 *
 * @param childContext
 * @param _id
 * @param _requirements
 */
var start = exports.start = function(childContext, _id, _requirements)
{
    var childTracker = {
        "requires": {},
        "produces": {}
    };

    var fc = function(parentTracker, childTracker, key)
    {
        if (parentTracker[key] && parentTracker[key].length > 0)
        {
            for (var k in parentTracker[key])
            {
                if (!childTracker[key][k]) {
                    childTracker[key][k] = [];
                }

                for (var i = 0; i < parentTracker[key][k].length; i++)
                {
                    childTracker[key][k].push(parentTracker[key][k][i]);
                }
            }
        }
    };

    // find the parent context
    var parentContext = getParentContext(childContext);
    if (parentContext)
    {
        // copy parent "requires" and "produces" into new child tracker object
        var parentTracker = trackerInstance(parentContext);
        if (parentTracker)
        {
            fc(parentTracker, childTracker, "requires");
            fc(parentTracker, childTracker, "produces");
        }
    }

    if (_id)
    {
        childTracker.id = _id;
    }

    if (_requirements)
    {
        requirements(childContext, _requirements);
    }
};

/**
 * Finishes a tracker.
 *
 * This hands back the tracker state.  It also copies tracker dependencies up to the parent tracker.
 *
 * @param parentContext
 * @param childContext
 * @returns the tracker context
 */
var finish = exports.finish = function(childContext)
{
    // child tracker
    var childTracker = trackerInstance(childContext);

    // find the parent context
    var parentContext = getParentContext(childContext);
    if (parentContext)
    {
        // parent tracker
        var parentTracker = trackerInstance(parentContext);

        // now copy stuff back up
        if (parentTracker)
        {
            // any "produces" dependencies always copies up
            for (var name in childTracker.produces)
            {
                var array = childTracker.produces[name];
                if (array)
                {
                    if (!parentTracker["produces"][name])
                    {
                        parentTracker["produces"][name] = [];
                    }

                    for (var i = 0; i < array.length; i++)
                    {
                        if (parentTracker["produces"][name].indexOf(array[i]) === -1)
                        {
                            parentTracker["produces"][name].push(array[i]);
                        }
                    }
                }
            }
        }
    }
};

/**
 * Marks that the current rendering requires the following requirements.
 *
 * @param context
 * @param requirements
 */
var requirements = exports.requirements = function(context, requirements)
{
    for (var k in requirements)
    {
        var v = requirements[k];
        if (v)
        {
            requires(context, k, v.value);
        }
    }
};

/**
 * Marks that the current rendering requires the following key=value to be in place.
 *
 * @param context
 * @param key
 * @param value
 */
var requires = exports.requires = function(context, key, value)
{
    if (typeof(value) !== "undefined" && value !== null)
    {
        var instance = trackerInstance(context);

        var requires = instance["requires"];

        var array = requires[key];
        if (!array)
        {
            requires[key] = array = [];
        }

        if (array.indexOf(value) === -1)
        {
            array.push(value);
        }
    }
};

/**
 * Marks that the current rendering produces a result that features the given key=value as part of its output.
 *
 * @param context
 * @param key
 * @param value
 */
var produces = exports.produces = function(context, key, value)
{
    if (typeof(value) !== "undefined" && value !== null)
    {
        var instance = trackerInstance(context);

        var produces = instance["produces"];

        var array = produces[key];
        if (!array)
        {
            array = [];
            produces[key] = array;
        }

        if (array.indexOf(value) === -1)
        {
            array.push(value);
        }
    }
};
