var exports = module.exports;

var util = require("../util/util");

/**
 * Pushes the tracker into the context ahead of rendering.
 *
 * @param currentContext
 * @param contextObject
 * @param context
 * @param id
 */
var start = exports.start = function(context, id, requirements)
{
    var newTracker = {
        "requires": {},
        "produces": {}
    };

    if (id)
    {
        newTracker.id = id;
    }

    var model = {
        "__tracker": newTracker
    };

    var fc = function(existingTracker, newTracker, superKey)
    {
        if (existingTracker[superKey] && existingTracker[superKey].length > 0)
        {
            for (var k in existingTracker[superKey])
            {
                if (!newTracker[superKey][k]) {
                    newTracker[superKey][k] = [];
                }

                for (var i = 0; i < existingTracker[superKey][k].length; i++)
                {
                    newTracker[superKey][k].push(existingTracker[superKey][k][i]);
                }
            }
        }
    };

    // copy existing state in
    var existingTracker = trackerInstance(context);
    if (existingTracker)
    {
        fc(existingTracker, newTracker, "requires");
        fc(existingTracker, newTracker, "produces");
    }

    context.push(model);

    if (requirements)
    {
        for (var k in requirements)
        {
            var v = requirements[k];
            if (v)
            {
                requires(context, k, v);
            }
        }
    }
};

var id = exports.id = function(context)
{
    return context.get("__tracker").id;
};

/**
 * Pops the tracker out of context when rendering finishes.
 *
 * This hands back the tracker state.  It also copies tracker dependencies up to the parent tracker.
 *
 * @param context
 * @returns the tracker context
 */
var finish = exports.finish = function(context)
{
    var executedTracker = context.pop()["__tracker"];

    var newCurrentTracker = trackerInstance(context);
    if (newCurrentTracker)
    {
        for (var i = 0; i < executedTracker.requires.length; i++)
        {
            newCurrentTracker["requires"].push(executedTracker.requires[i]);
        }
        for (var i = 0; i < executedTracker.produces.length; i++)
        {
            newCurrentTracker["produces"].push(executedTracker.produces[i]);
        }
    }

    return executedTracker;
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
    var instance = trackerInstance(context);

    var requires = instance["requires"];

    var array = requires[key];
    if (!array) {
        requires[key] = array = [];
    }

    if (array.indexOf(value) === -1)
    {
        array.push(value);
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
    var instance = trackerInstance(context);

    var produces = instance["produces"];

    var array = produces[key];
    if (!array) {
        array = [];
        produces[key] = array;
    }

    if (array.indexOf(value) === -1)
    {
        array.push(value);
    }
};

var trackerInstance = function(context)
{
    return context.get("__tracker");
};


