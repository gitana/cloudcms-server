exports.generateSubscriberKey = function() {

    var count = 0;

    return function(pageKey, region, order)
    {
        return "gadget" + (count++);
    }
}();
