(function($) {

    var Alpaca = $.alpaca;

    Alpaca.AppServerConnector = Alpaca.Connector.extend(
    /**
     * @lends Alpaca.AppServerConnector.prototype
     */
    {
        /**
         * Loads data from Cloud CMS.
         *
         * @param {String} nodeId the node id to load
         * @param {Object} resources Map of resources
         * @param {Function} onSuccess onSuccess callback
         * @param {Function} onError onError callback
         */
        loadData: function (nodeId, resources, successCallback, errorCallback)
        {
            var self = this;

            return self.base(nodeId, resources, successCallback, errorCallback);
        },

        /**
         * Loads json schema from Cloud CMS.
         *
         * @param {Object|String} schemaIdentifier the definition qname to load
         * @param {Object} resources Map of resources
         * @param {Function} onSuccess onSuccess callback.
         * @param {Function} onError onError callback.
         */
        loadSchema: function (schemaIdentifier, resources, successCallback, errorCallback)
        {
            var self = this;

            return self.base(schemaIdentifier, resources, successCallback, errorCallback);
        },

        /**
         * Loads json options from Cloud CMS.
         *
         * @param {Object|String} optionsIdentifier the form key to load
         * @param {Object} resources Map of resources
         * @param {Function} onSuccess onSuccess callback.
         * @param {Function} onError onError callback.
         */
        loadOptions: function (optionsIdentifier, resources, successCallback, errorCallback)
        {
            var self = this;

            return self.base(optionsIdentifier, resources, successCallback, errorCallback);
        },

        /**
         * Loads a referenced JSON schema by it's qname from Cloud CMS.
         *
         * @param {Object|String} schemaIdentifier schema to load
         * @param {Function} onSuccess onSuccess callback.
         * @param {Function} onError onError callback.
         */
        loadReferenceSchema: function (schemaIdentifier, successCallback, errorCallback)
        {
            var self = this;

            return self.loadSchema(schemaIdentifier, successCallback, errorCallback);
        },

        /**
         * Loads referenced JSON options by it's form key from Cloud CMS.
         *
         * @param {Object|String} optionsIdentifier form to load.
         * @param {Function} onSuccess onSuccess callback.
         * @param {Function} onError onError callback.
         */
        loadReferenceOptions: function (optionsIdentifier, successCallback, errorCallback)
        {
            var self = this;

            return self.loadOptions(optionsIdentifier, successCallback, errorCallback);
        },

        /**
         * Loads data source elements based on a content query to Cloud CMS.
         *
         * @param config
         * @param successCallback
         * @param errorCallback
         * @returns {*}
         */
        loadDataSource: function (config, successCallback, errorCallback)
        {
            var self = this;

            var pagination = config.pagination;
            delete config.pagination;

            var ajaxConfig = {
                "url": "/form/datasource",
                "type": "post"
            };

            ajaxConfig["success"] = function(jsonDocument) {
                successCallback(jsonDocument);
            };
            ajaxConfig["error"] = function(jqXHR, textStatus, errorThrown) {
                errorCallback({
                    "message":"Unable to load data from uri : " + ajaxConfig.url,
                    "stage": "DATA_LOADING_ERROR",
                    "details": {
                        "jqXHR" : jqXHR,
                        "textStatus" : textStatus,
                        "errorThrown" : errorThrown
                    }
                });
            };

            $.ajax(ajaxConfig);
        }

    });

    Alpaca.registerConnectorClass("appserver", Alpaca.AppServerConnector);

})(jQuery);
