require([
    'dart-board/FindAddress',

    'dojo/Deferred',
    'dojo/dom-class',
    'dojo/dom-construct',
    'dojo/dom-style',
    'dojo/query',
    'dojo/_base/window',

    'esri/geometry/Extent',
    'esri/geometry/Point',
    'esri/geometry/SpatialReference',
    'esri/layers/GraphicsLayer',
    'esri/Map',
    'esri/views/MapView'
], function (
    FindAddress,

    Deferred,
    domClass,
    domConstruct,
    domStyle,
    query,
    win,

    Extent,
    Point,
    SpatialReference,
    GraphicsLayer,
    Map,
    MapView
) {
    var widget;
    var address = '123 S Main St';
    var zip = '84101';
    var result = {
        data: {
            'result': {
                'location': {
                    'x': 424808.49945603119,
                    'y': 4513232.5811240105
                },
                'score': 100.0,
                'locator': 'Centerlines.StatewideRoads',
                'matchAddress': '123 S MAIN ST, 84101',
                'inputAddress': '123 S Main St, 84101'
            },
            'status': 200
        }
    };

    afterEach(function () {
        if (widget) {
            widget.destroy();
            widget = null;
        }
    });

    describe('agrc/widgets/locate/FindAddress', function () {
        describe('Without Map', function () {
            beforeEach(function () {
                widget = new FindAddress(null, domConstruct.create('div', null, win.body()));
            });
            it('should not create a default symbol if no mapView was provided', function () {
                expect(widget.symbol).toBeNull();
            });

            it('should not assign a graphics layer if no mapView was provided', function () {
                expect(widget.graphicsLayer).toBeNull();
            });

            it('should validate when there is data in textboxes', function () {
                widget.txtAddress.value = 'x';
                widget.txtZone.value = 'x';

                expect(widget._validate()).toBeTruthy();
            });

            it('should not validate when there is not data in textboxes', function () {
                widget.txtAddress.value = 'x';

                expect(widget._validate()).toBeFalsy();
            });

            it('should successfully find a valid address', function () {
                widget.txtAddress.value = address;
                widget.txtZone.value = zip;

                //fake that error has already happened
                domClass.add(widget.errorMsg.parentElement, 'has-error');

                spyOn(widget, '_invokeWebService').and.callFake(function () {
                    var d = new Deferred();
                    d.resolve(result);

                    return d;
                });

                spyOn(widget, '_onFind').and.callThrough();
                spyOn(widget, 'onFind').and.callThrough();
                spyOn(widget, '_onError').and.callThrough();

                widget.geocodeAddress();

                expect(widget._invokeWebService).toHaveBeenCalledWith({
                    street: address,
                    zone: zip
                });

                expect(widget._onFind).toHaveBeenCalled();
                expect(widget._onFind).toHaveBeenCalledWith(result);

                expect(widget.onFind).toHaveBeenCalled();

                expect(widget._onError).not.toHaveBeenCalled();

                expect(domClass.contains(widget.errorMsg.parentElement, 'has-error')).toBeFalsy();
            });

            it('should display a not found message for a nonvalid address', function () {
                widget.txtAddress.value = 'x';
                widget.txtZone.value = 'x';

                spyOn(widget, '_invokeWebService').and.callFake(function () {
                    var d = new Deferred();
                    d.reject({});

                    return d;
                });

                spyOn(widget, '_onFind').and.callThrough();
                spyOn(widget, '_onError').and.callThrough();

                widget.geocodeAddress();

                expect(widget._onError).toHaveBeenCalled();
                expect(widget._onFind).not.toHaveBeenCalled();

                expect(domStyle.get(widget.errorMsg, 'display')).toEqual('inline');
            });

            it('should use spatialReference ctor param first', function () {
                widget = new FindAddress({
                    wkid: 3857
                }).placeAt(win.body());

                expect(widget.wkid).toEqual(3857);
            });

            it('should use default spatialReference value if not supplied', function () {
                expect(widget.wkid).toEqual(3857);
            });
        });

        describe('With Map', function () {
            var mapView;

            beforeEach(function (done) {
                mapView = new MapView({
                    map: new Map({basemap: 'streets'}),
                    container: domConstruct.create('div', null, document.body)
                });

                mapView.then(() => {
                    done();
                });
            });

            afterEach(function () {
                mapView.destroy();
                mapView = null;
            });

            it('should create a default symbol if a mapView was provided', function () {
                widget = new FindAddress({
                    mapView
                }).placeAt(win.body());

                expect(widget.symbol).not.toBeNull();
            });

            it('should assign a graphics layer if a mapView was provided', function () {
                widget = new FindAddress({
                    mapView
                }).placeAt(win.body());

                expect(widget.graphicsLayer).not.toBeNull();
                expect(widget.graphicsLayer).not.toBe('default');
            });

            it('should use my graphics layer if provided', function () {
                var id = 'layerId';
                widget = new FindAddress({
                    mapView,
                    graphicsLayer: new GraphicsLayer({id})
                }).placeAt(win.body());

                expect(widget.graphicsLayer.id).toEqual(id);
            });

            it('should zoom to a point after finding a valid address on a cached mapView', function () {
                var point = new Point(result.data.result.location.x, result.data.result.location.y, mapView.spatialReference);

                widget = new FindAddress({
                    mapView,
                    graphicsLayer: mapView.graphicsLayer
                }).placeAt(win.body());
                widget.txtAddress.value = address;
                widget.txtZone.value = zip;

                spyOn(widget, '_invokeWebService').and.callFake(function () {
                    var d = new Deferred();
                    d.resolve(result);

                    return d;
                });

                widget.geocodeAddress();

                expect(widget.mapView.center).toEqual(point);
                expect(widget.mapView.zoom).toEqual(12);
                expect(widget.mapView._graphic).not.toBeNull();
            });

            it('should use constructor spatialReference first', function () {
                widget = new FindAddress({
                    mapView,
                    graphicsLayer: mapView.graphicsLayer,
                    wkid: 10
                }).placeAt(win.body());

                expect(widget.wkid).toEqual(10);
            });

            it('should use mapView spatialReference if no constructor param', function (done) {
                mapView.spatialReference = new SpatialReference({
                    wkid: 3857
                });

                widget = new FindAddress({
                    mapView,
                    graphicsLayer: mapView.graphicsLayer
                }).placeAt(win.body());

                mapView.then(() => {
                    expect(widget.wkid).toEqual(3857);
                    done();
                });
            });
        });
        describe('_validate', function () {
            beforeEach(function () {
                widget = new FindAddress(null, domConstruct.create('div', null, win.body()));
            });
            it('hides all error messages', function () {
                query('.help-inline.error', widget.domNode).style('display', 'visible');
                widget.txtAddress.value = address;
                widget.txtZone.value = zip;

                widget._validate();

                expect(query('.help-inline.error', widget.domNode).every(function (node) {
                    return domStyle.get(node, 'display') === 'none';
                })).toBe(true);
            });
            it('removes all error classes on control-groups', function () {
                query('.control-group', widget.domNode).addClass('error');
                widget.txtAddress.value = address;
                widget.txtZone.value = zip;

                widget._validate();

                expect(query('.control-group', widget.domNode).every(function (node) {
                    return !domClass.contains(node, 'error');
                })).toBe(true);
            });
        });
    });
});
