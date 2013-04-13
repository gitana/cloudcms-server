/*
$(document).ready(function() {

    // bring up in-context menu with SHIFT, SHIFT, SHIFT combination
    var SHIFT = 16;
    var sequence = [ SHIFT, SHIFT, SHIFT ];
    var sequenceIndex = 0;
    $(document).keyup(function(event)
    {
        if (event.keyCode == sequence[sequenceIndex]) {
            sequenceIndex++;

            if (sequenceIndex == sequence.length) {
                sequenceIndex = 0;

                popupAuthorDialog();
                return true;
            }

        } else {
            sequenceIndex = 0;
        }

        return false;
    });

    var popupAuthorDialog = function()
    {
        var authorDialog = $("#authorDialog");

        if ($(authorDialog).length == 0)
        {
            var html = '<div data-role="dialog" id="authorDialog" > \
                    <div data-role="header"><h3>What would you like to do?</h3></div> \
                    <div data-role="content"> \
                    <ul data-role="listview" data-inset="true" style="min-width:210px;" data-theme="a"> \
                        <li><a href="#" class="invalidate-cache" data-inline="true" data-prefetch="true" data-iconpos="notext" data-transition="none">Invalidate Cache</a></li> \
                        <li><a href="#" class="edit-mobile-project" data-inline="true" data-prefetch="true" data-iconpos="notext" data-transition="none">Edit Mobile Project</a></li> \
                        <li><a href="#" class="edit-page" data-inline="true" data-prefetch="true" data-iconpos="notext" data-transition="none">Edit this Page</a></li> \
                        <li><a href="#" class="switch-branch" data-inline="true" data-prefetch="true" data-iconpos="notext" data-transition="none">Switch Branches</a></li> \
                    </ul> \
                    </div> \
                </div> \
            ';

            authorDialog = $(html);

            $(authorDialog).find(".invalidate-cache").click(function() {
                $(authorDialog).dialog('close');
                var location = window.location.href;
                var x = location.indexOf("#");
                if (x > -1 && location.indexOf("?invalidate") == -1)
                {
                    location = location.substring(0, x) + "?invalidate=true" + location.substring(x);
                }
                var y = location.indexOf("&ui-state=dialog");
                if (y > -1)
                {
                    location = location.substring(0, y) + location.substring(y + 16);
                }
                window.location.href = location;
            });
            $(authorDialog).find(".edit-page").click(function() {
                $(authorDialog).dialog('close');
            });
            $(authorDialog).find(".switch-branch").click(function() {
                $(authorDialog).dialog('close');
                popupBranchSelectionDialog();
            });
            $(authorDialog).find(".edit-mobile-project").click(function() {
                $(authorDialog).dialog('close');
                window.open("http://demo.cloudcms.net/console/#/repositories/d2039858cca205b23b7b/branches/b1dbc57b64c2426da244/folders/821c40ab613d9b5bcbbc656b62229301");
            });

            $(authorDialog).appendTo($.mobile.pageContainer);
        }

        $.mobile.changePage(authorDialog,{'transition':'pop'});
    };

    var popupBranchSelectionDialog = function()
    {
        var branchSelectionDialog = $("#branchSelectionDialog");

        if ($(branchSelectionDialog).length == 0)
        {
            var html = ' \
                <div data-role="dialog" id="branchSelectionDialog" > \
                    <div data-role="header"><h3>Select a Branch</h3></div> \
                    <div data-role="content"> \
                    <ul data-role="listview" data-inset="true" style="min-width:210px;" data-theme="a"> \
                        <li><a href="#" data-inline="true" data-prefetch="true" data-iconpos="notext" data-transition="none">Master</a></li> \
                        <li><a href="#" data-inline="true" data-prefetch="true" data-iconpos="notext" data-transition="none">Sandbox 1</a></li> \
                        <li><a href="#" data-inline="true" data-prefetch="true" data-iconpos="notext" data-transition="none">Test Branch</a></li> \
                    </ul> \
                    </div> \
                </div> \
            ';

            branchSelectionDialog = $(html);

            $(branchSelectionDialog).appendTo($.mobile.pageContainer);
        }

        $.mobile.changePage(branchSelectionDialog,{'transition':'pop'});
    };

});
*/
