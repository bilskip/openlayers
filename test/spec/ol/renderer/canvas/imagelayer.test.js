import Feature from '../../../../../src/ol/Feature.js';
import ImageLayer from '../../../../../src/ol/layer/Image.js';
import Map from '../../../../../src/ol/Map.js';
import Point from '../../../../../src/ol/geom/Point.js';
import Projection from '../../../../../src/ol/proj/Projection.js';
import Static from '../../../../../src/ol/source/ImageStatic.js';
import VectorImageLayer from '../../../../../src/ol/layer/VectorImage.js';
import VectorSource from '../../../../../src/ol/source/Vector.js';
import View from '../../../../../src/ol/View.js';
import {get as getProj} from '../../../../../src/ol/proj.js';

describe('ol.renderer.canvas.ImageLayer', function () {
  describe('#forEachLayerAtCoordinate', function () {
    let map, target, source;
    beforeEach(function (done) {
      const projection = new Projection({
        code: 'custom-image',
        units: 'pixels',
        extent: [0, 0, 200, 200],
      });
      target = document.createElement('div');
      target.style.width = '100px';
      target.style.height = '100px';
      document.body.appendChild(target);
      source = new Static({
        url: 'spec/ol/data/dot.png',
        projection: projection,
        imageExtent: [0, 0, 20, 20],
      });
      map = new Map({
        pixelRatio: 1,
        target: target,
        layers: [
          new ImageLayer({
            source: source,
          }),
        ],
        view: new View({
          projection: projection,
          center: [10, 10],
          zoom: 2,
          maxZoom: 8,
        }),
      });
      source.on('imageloadend', function () {
        done();
      });
    });

    afterEach(function () {
      map.setTarget(null);
      document.body.removeChild(target);
    });

    it('properly detects pixels', function () {
      map.renderSync();
      let has = false;
      function hasLayer() {
        has = true;
      }
      map.forEachLayerAtPixel([20, 80], hasLayer);
      expect(has).to.be(true);
      has = false;
      map.forEachLayerAtPixel([10, 90], hasLayer);
      expect(has).to.be(false);
    });
  });

  describe('#forEachLayerAtPixel Image CORS', function () {
    let map,
      target,
      imageExtent,
      projection,
      sourceCross,
      source,
      imageLayer,
      imageLayerCross;
    beforeEach(function (done) {
      projection = new Projection({
        code: 'custom-image',
        units: 'pixels',
        extent: [0, 0, 200, 200],
      });
      target = document.createElement('div');
      target.style.width = '100px';
      target.style.height = '100px';
      document.body.appendChild(target);
      imageExtent = [0, 0, 20, 20];
      source = new Static({
        url: `https://openlayers.org/assets/theme/img/logo70.png`,
        projection: projection,
        imageExtent: imageExtent,
      });
      imageLayer = new ImageLayer({
        source: source,
      });
      sourceCross = new Static({
        url: `https://openlayers.org/assets/theme/img/logo70.png`,
        projection: projection,
        imageExtent: imageExtent,
        crossOrigin: 'anonymous',
      });
      imageLayerCross = new ImageLayer({
        source: sourceCross,
      });
      map = new Map({
        pixelRatio: 1,
        target: target,
        layers: [imageLayer, imageLayerCross],
        view: new View({
          projection: projection,
          center: [10, 10],
          zoom: 1,
          maxZoom: 8,
        }),
      });
      let loadedCount = 0;
      [source, sourceCross].forEach(function (source) {
        source.once('imageloadend', function () {
          loadedCount++;
          if (loadedCount === 2) {
            done();
          }
        });
      });
    });

    afterEach(function () {
      map.setTarget(null);
      document.body.removeChild(target);
    });

    it('should detect pixels even if there is no color because neither crossOrigin or extent is set', function () {
      imageLayerCross.setVisible(false);
      imageLayer.setVisible(true);
      map.renderSync();
      let has = false;
      function hasLayer() {
        has = true;
      }
      map.forEachLayerAtPixel([50, 50], hasLayer);
      expect(has).to.be(true);
      has = false;
      map.forEachLayerAtPixel([10, 10], hasLayer);
      expect(has).to.be(true);
    });

    it('should not detect pixels outside of the layer extent with crossOrigin set', function () {
      imageLayerCross.setVisible(true);
      imageLayer.setVisible(false);
      map.renderSync();
      let has = false;
      function hasLayer() {
        has = true;
      }
      map.forEachLayerAtPixel([50, 50], hasLayer);
      expect(has).to.be(true);
      has = false;
      map.forEachLayerAtPixel([10, 10], hasLayer);
      expect(has).to.be(false);
    });

    it('should not detect pixels outside of the layer extent with extent set', function () {
      imageLayerCross.setVisible(true);
      imageLayerCross.setExtent(imageExtent);
      imageLayer.setVisible(false);
      map.renderSync();
      let has = false;
      function hasLayer() {
        has = true;
      }
      map.forEachLayerAtPixel([50, 50], hasLayer);
      expect(has).to.be(true);
      has = false;
      map.forEachLayerAtPixel([10, 10], hasLayer);
      expect(has).to.be(false);
    });
  });

  describe('#getDataAtPixel', function () {
    let map, target, source, imageLayer;
    beforeEach(function (done) {
      const projection = new Projection({
        code: 'custom-image',
        units: 'pixels',
        extent: [0, 0, 200, 200],
      });
      target = document.createElement('div');
      target.style.width = '100px';
      target.style.height = '100px';
      document.body.appendChild(target);
      const imageExtent = [0, 0, 20, 20];
      source = new Static({
        url: 'spec/ol/data/dot.png',
        projection: projection,
        imageExtent: imageExtent,
      });
      imageLayer = new ImageLayer({
        source: source,
        extent: imageExtent,
      });
      map = new Map({
        pixelRatio: 1,
        target: target,
        layers: [imageLayer],
        view: new View({
          projection: projection,
          center: [10, 10],
          zoom: 1,
          maxZoom: 8,
        }),
      });
      source.on('imageloadend', function () {
        done();
      });
    });

    afterEach(function () {
      map.setTarget(null);
      document.body.removeChild(target);
    });

    it('should not detect pixels outside of the layer extent', function () {
      map.renderSync();
      const pixel = [10, 10];
      const frameState = map.frameState_;
      const hitTolerance = 0;
      const layerRenderer = imageLayer.getRenderer();
      const data = layerRenderer.getDataAtPixel(
        pixel,
        frameState,
        hitTolerance
      );
      expect(data).to.be(null);
    });

    it('should detect pixels in the layer extent', function () {
      map.renderSync();
      const pixel = [50, 50];
      const frameState = map.frameState_;
      const hitTolerance = 0;
      const layerRenderer = imageLayer.getRenderer();
      const data = layerRenderer.getDataAtPixel(
        pixel,
        frameState,
        hitTolerance
      );
      expect(data.length > 0).to.be(true);
    });
  });

  describe('Image rendering', function () {
    let map, div, layer;

    beforeEach(function (done) {
      const projection = getProj('EPSG:3857');
      layer = new ImageLayer({
        source: new Static({
          url: 'spec/ol/data/osm-0-0-0.png',
          imageExtent: projection.getExtent(),
          projection: projection,
        }),
      });

      div = document.createElement('div');
      div.style.width = '100px';
      div.style.height = '100px';
      document.body.appendChild(div);
      map = new Map({
        target: div,
        layers: [layer],
        view: new View({
          center: [0, 0],
          zoom: 2,
        }),
      });
      layer.getSource().on('imageloadend', function () {
        done();
      });
    });

    afterEach(function () {
      map.setTarget(null);
      document.body.removeChild(div);
      map.dispose();
    });

    it('dispatches prerender and postrender events on the image layer', function (done) {
      let prerender = 0;
      let postrender = 0;
      layer.on('prerender', function () {
        ++prerender;
      });
      layer.on('postrender', function () {
        ++postrender;
      });
      map.on('postrender', function () {
        expect(prerender).to.be(1);
        expect(postrender).to.be(1);
        done();
      });
    });
  });

  describe('Vector image rendering', function () {
    let map, div, layer;

    beforeEach(function () {
      layer = new VectorImageLayer({
        source: new VectorSource({
          features: [new Feature(new Point([0, 0]))],
        }),
      });

      div = document.createElement('div');
      div.style.width = '100px';
      div.style.height = '100px';
      document.body.appendChild(div);
      map = new Map({
        target: div,
        layers: [layer],
        view: new View({
          center: [0, 0],
          zoom: 2,
        }),
      });
    });

    afterEach(function () {
      map.setTarget(null);
      document.body.removeChild(div);
      map.dispose();
    });

    it('dispatches prerender and postrender events on the vector layer', function (done) {
      let prerender = 0;
      let postrender = 0;
      layer.on('prerender', function () {
        ++prerender;
      });
      layer.on('postrender', function () {
        ++postrender;
      });
      map.once('postrender', function () {
        expect(prerender).to.be(1);
        expect(postrender).to.be(1);
        done();
      });
    });
  });
});
