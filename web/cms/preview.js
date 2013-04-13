if (typeof($) !== "undefined")
{
    // only do this code injection if we're running in a preview frame
    if (parent.cmsPostMessage)
    {
        (function() {

            var collectFields = function(el, array)
            {
                // look for any elements with special markup
                $(el).find("[data-field-id]").each(function() {

                    var contentFieldId = $(this).attr("data-field-id");

                    // content type
                    var contentFieldType = $(this).attr("data-field-type");
                    if (!contentFieldType) {
                        contentFieldType = "string";
                    }

                    var contentField = {
                        "id": contentFieldId,
                        "type": contentFieldType
                    };

                    // value
                    var contentFieldValue = $(this).attr("data-field-value");
                    if (!contentFieldValue) {
                        // pull html value for certain tags
                        if (["p", "div", "span", "textarea"].indexOf($(this)[0].nodeName.toLowerCase()) > -1) {
                            contentFieldValue = $(this).html();
                        }
                        // pull value for form tags
                        if (["input"].indexOf($(this)[0].nodeName.toLowerCase()) > -1) {
                            contentFieldValue = $(this).val();
                        }
                    }
                    if (contentFieldValue) {
                        if (typeof(contentFieldValue) == "string") {
                            contentFieldValue = $.trim(contentFieldValue);
                        }
                        contentField.value = contentFieldValue;
                    }

                    // title
                    var contentFieldTitle = $(this).attr("data-field-title");
                    if (contentFieldTitle) {
                        contentField.title = contentFieldTitle;
                    }

                    array.push(contentField);
                });
            };

            var handle = function(allElement, currentElement)
            {
                var payload = {
                    "type": "fields",
                    "data": {
                        "pathname": window.location.pathname,
                        "hash": window.location.hash,
                        "search": window.location.search,
                        "href": window.location.href,
                        "allFields": [],
                        "currentFields": []
                    }
                };

                // collect all + current fields
                collectFields(allElement, payload.data.allFields);
                collectFields(currentElement, payload.data.currentFields);

                // send field information to preview server
                parent.cmsPostMessage(payload);
            };

            // if we're running in jQuery mobile, we attach to the "pageshow" method
            if ($.mobile)
            {
                // tell jquery mobile to update preview location whenever the page changes
                $(document).bind('pageshow', function(event) {

                    // the whole body
                    var allElement = $(document.body);

                    // the current element
                    // the "page show" event yields the selected dom element (for single page 'multi-page' apps)
                    var currentElement = $(event.target);
                    handle(allElement, currentElement);
                });
            }
            else
            {
                // bind to document ready
                $(document).ready(function() {

                    // we use the document body for both
                    var allElement = $(document.body);
                    handle(allElement, allElement);

                });
            }

        })();
    }
}
