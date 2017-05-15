define([
    'dijit/_TemplatedMixin',
    'dijit/_WidgetBase',

    'dojo/dom-class',
    'dojo/on',
    'dojo/query',
    'dojo/string',
    'dojo/text!./resources/templates/FindAddress.html',
    'dojo/topic',
    'dojo/_base/array',
    'dojo/_base/declare',
    'dojo/_base/lang',

    'esri/config',
    'esri/geometry/Point',
    'esri/geometry/SpatialReference',
    'esri/Graphic',
    'esri/request',
    'esri/symbols/SimpleMarkerSymbol'
], function (
    _TemplatedMixin,
    _WidgetBase,

    domClass,
    on,
    query,
    dojoString,
    template,
    topic,
    array,
    declare,
    lang,

    esriConfig,
    Point,
    SpatialReference,
    Graphic,
    esriRequest,
    SimpleMarkerSymbol
) {
    // description:
    //      A simple form tied to the map allowing a user to quickly zoom to an address.
    //      **Published Topics**:
    //      </p>
    //      <ul>
    //          <li>dart-board.FindAddress.OnFindStart[none]</li>
    //          <li>dart-board.FindAddress.OnFind[result]</li>
    //          <li>dart-board.FindAddress.OnFindError[err]</li>
    //      </ul>
    //      **Exceptions**:
    //      </p>
    //      <ul><li>none</li></ul>
    //      <p>
    //      **Required Files**:
    //      </p>
    //      <ul><li>resources/FindAddress.css</li></ul>
    //
    // example:
    // |    new FindAddress({mapView: mapView}, 'test1');
    var defaultSpatialReference = 3857;

    return declare([_WidgetBase, _TemplatedMixin], {
        templateString: template,
        baseClass: 'find-address',
        map: null,
        title: 'Find Street Address',
        symbol: null,
        graphicsLayer: null,
        _graphic: null,
        zoomLevel: 12,
        apiKey: null,
        wkid: null,

        // inline: Boolean (optional)
        //      Controls if form is inline or normal (default) layout
        inline: null,

        constructor: function () {
            // summary:
            //      first function to fire after page loads
            console.info('dart-board.FindAddress:constructor', arguments);

            esriConfig.request.corsEnabledServers.push('api.mapserv.utah.gov');
        },
        postMixInProperties: function () {
            // summary:
            //      postMixin properties like symbol and graphics layer
            // description:
            //      decide whether to use default graphics layer and symbol
            // tags:
            //      public
            console.info('dart-board.FindAddress:postMixInProperties', arguments);

            if (this.mapView) {
                // default to use the map's graphics layer if none was passed in
                if (!this.graphicsLayer) {
                    this.graphicsLayer = this.mapView.graphics;
                }

                // create symbol if none was provided in options
                if (!this.symbol) {
                    this.symbol = new SimpleMarkerSymbol({
                        style: 'diamond',
                        color: [255, 0, 0, 0.5]
                    });
                }

                this.mapView.then(() => {
                    if (!this.wkid) {
                        this.wkid = (this.mapView) ? this.mapView.spatialReference.wkid : defaultSpatialReference;
                    }
                });
            } else {
                if (!this.wkid) {
                    this.wkid = defaultSpatialReference;
                }
            }
        },
        postCreate: function () {
            console.info('dart-board.FindAddress:postCreate', arguments);

            this.formGeocode.onsubmit = function () {
                return false;
            };

            if (this.inline) {
                domClass.add(this.formGeocode, 'form-inline');
            }

            on(this.btnGeocode, 'click', lang.hitch(this, 'geocodeAddress'));
        },
        geocodeAddress: function () {
            // summary:
            //      Geocodes the address if the text boxes validate.
            console.info('dart-board.FindAddress:geocodeAddress', arguments);

            if (!this._validate()) {
                this._done();
                return false;
            }

            topic.publish('dart-board.FindAddress.OnFindStart');

            this._geocoding();

            if (this.mapView && this._graphic) {
                this.graphicsLayer.remove(this._graphic);
            }

            var address = this.txtAddress.value;
            var zone = this.txtZone.value;

            if (this.request) {
                this.request.cancel('duplicate in flight');
                this.request = null;
            }

            this.request = this._invokeWebService({
                street: address,
                zone: zone
            }).then(
                lang.hitch(this, '_onFind'), lang.hitch(this, '_onError')
            );

            return false;
        },
        _invokeWebService: function (geocode) {
            // summary:
            //      calls the web service
            // description:
            //      sends the request to the wsut webservice
            // tags:
            //      private
            // returns:
            //     Deferred
            console.info('dart-board.FindAddress:_invokeWebService', arguments);

            var url = `//api.mapserv.utah.gov/api/v1/Geocode/${geocode.street}/${geocode.zone}`;

            var options = {
                apiKey: this.apiKey,
                spatialReference: this.wkid
            };

            return esriRequest(url, {
                query: options,
                handleAs: 'json'
            });
        },
        _validate: function () {
            // summary:
            //      validates the widget
            // description:
            //      makes sure the street and zone have valid data
            // tags:
            //      private
            // returns:
            //      bool
            console.info('dart-board.FindAddress:_validate', arguments);

            var that = this;

            // hide error messages
            query('.form-group', this.domNode).removeClass('has-error');

            return array.every([this.txtAddress, this.txtZone], function (tb) {
                return that._isValid(tb);
            });
        },
        _isValid: function (textBox) {
            // summary:
            //      validates that there are values in the textbox
            // textBox: TextBox Element
            console.log('dart-board.FindAddress:_isValid', arguments);

            var valid = dojoString.trim(textBox.value).length > 0;

            if (!valid) {
                domClass.add(textBox.parentElement, 'has-error');
            }

            return valid;
        },
        _geocoding: function () {

        },
        _done: function () {

        },
        onFind: function () {

        },
        _onFind: function (response) {
            // summary:
            //      handles a successful geocode
            // description:
            //      zooms the map if there is one. publishes the result
            // tags:
            //      private
            console.info('dart-board.FindAddress:_onFind', arguments);

            if (response.data.status === 200) {
                this.onFind(response.data.result);

                if (this.mapView) {
                    var point = new Point({
                        x: response.data.result.location.x,
                        y: response.data.result.location.y,
                        spatialReference: {wkid: this.wkid}
                    });

                    if (this.mapView.zoom > -1) {
                        this.mapView.goTo({
                            target: point,
                            zoom: this.zoomLevel
                        });
                    } else {
                        this.mapView.goTo({
                            target: point,
                            scale: this.mapView.scale / this.zoomLevel
                        });
                    }

                    var symbol = new SimpleMarkerSymbol({
                        style: 'diamond',
                        color: [255, 0, 0, 0.5]
                    });
                    this._graphic = new Graphic({
                        geometry: point,
                        symbol: symbol
                        // attributes: response.data.result
                    });
                    this.graphicsLayer.add(this._graphic);
                }

                this._done();

                topic.publish('dart-board.FindAddress.OnFind', [response.data.result]);
            } else {
                this._onError();
            }
        },
        _onError: function (err) {
            // summary:
            //      handles script io geocoding error
            // description:
            //      publishes error
            // tags:
            //      private
            // returns:
            //
            console.info('dart-board.FindAddress:_onError', arguments);

            domClass.add(this.errorMsg.parentElement, 'has-error');

            // re-enable find button
            this._done();

            topic.publish('dart-board.FindAddress.OnFindError', [err]);
        }
    });
});
