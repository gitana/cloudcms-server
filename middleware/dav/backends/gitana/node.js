var jsDAV_iNode = require("jsDAV/lib/DAV/interfaces/iNode");

var Util = require("jsDAV/lib/DAV/shared/util");

var jsDAV_Dropbox_Node = module.exports = jsDAV_iNode.extend({
    initialize: function(path, client) {
        this.path = path;
        this.client = client;
    },

    /**
     * Returns the name of the node
     *
     * @return {string}
     */
    getName: function() {
        return Util.splitPath(this.path)[1];
    },

    /**
     * Renames the node
     *
     * @param {string} name The new name
     * @return void
     */
    setName: function(name, cbfssetname) {
        var parentPath = Util.splitPath(this.path)[0];
        var newName    = Util.splitPath(name)[1];

        var newPath = parentPath + "/" + newName;
        var self = this;
        this.client.mv(this.path, newPath, function(status, res) {
            if (self.client.isError(status))
                return cbfssetname(res);
            self.path = newPath;
            cbfssetname();
        });
    },

    /**
     * Returns the last modification time, as a unix timestamp
     *
     * @return {Number}
     */
    getLastModified: function(cbfsgetlm) {
        if (this.$stat)
            return cbfsgetlm(null, this.$stat.mtime);
        var self = this;
        this.client.metadata(this.path, function(status, stat) {
            if (self.client.isError(status))
                return cbfsgetlm(stat);
            //_self.$stat = stat;
            cbfsgetlm(null, (new Date(stat.modified)).getTime());
        });
    },

    /**
     * Returns whether a node exists or not
     *
     * @return {Boolean}
     */
    exists: function(cbfsexist) {
        this.getLastModified(function(err) {
            cbfsexist(!!err);
        });
    }
});