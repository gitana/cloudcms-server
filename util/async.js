var exports = module.exports;

exports.series = function(fns, args, finalCallback)
{
    var self = this;

    var f = function(index)
    {
        if (index === fns.length)
        {
            // we're done
            finalCallback();
            return;
        }

        var fn = fns[index];

        var localCallback = function(err)
        {
            if (err) {
                finalCallback(err);
                return;
            }

            f(index + 1);
        };

        var list = [];
        for (var z = 0; z < args.length; z++)
        {
            list.push(args[z]);
        }
        list.push(localCallback);

        fn.apply(self, list)
    };

    f(0);
};