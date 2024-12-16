import MVT from 'ol/format/MVT.js';
import TileQueue, {
  getTilePriority as tilePriorityFunction,
} from 'ol/TileQueue.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import {get} from 'ol/proj.js';
import {inView} from 'ol/layer/Layer.js';
import {stylefunction} from 'ol-mapbox-style';
import {Circle, Fill, Style, Text} from 'ol/style';
import {VectorImage} from 'ol/layer';
import VectorSource from 'ol/source/Vector';
import {createXYZ} from 'ol/tilegrid';
import {Feature} from 'ol';
import {tile} from 'ol/loadingstrategy';
import {containsExtent} from 'ol/extent';
// import store from '../store';
// import api from '@/services/api';

// const key = 'U5cD0LAZLTsmYMfq8WVu';

/** @type {any} */
const worker = self;

// const testLoader = (
//   tile,
//   layerId,
//   {filters, styleAttributes} = {},
//   forceNonCache = false,
// ) => {
//   tile.setLoader(async (extent, resolution, featureProjection) => {
//     let responseArrayBuffer;
//     let params = {
//       layerId,
//       envelope: extent,
//       zxy: tile.tileCoord,
//     };
//     const r = await axios.post(
//       `https://aquagis3-dev.gis.support/api/mvt_service/${params.layerId}`,
//       {data: {envelope: params.envelope, zxy: params.zxy, use_cache: true}},
//       {
//         responseType: 'arraybuffer',
//         skipDefaultErrorHandler: true,
//         headers: {
//           'X-Access-Token':
//             'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOjc3OTIsImlhdCI6MTczMzQ5MTg4OCwidXNlciI6MX0.Bkz8zfWYEVDl2UxF3u7EM7IV8aVmrJoq4uqli3-o0Sk',
//         },
//       },
//     );
//     // console.log(r.data);
//     responseArrayBuffer = r.data;
//     const features = tile.getFormat().readFeatures(responseArrayBuffer, {
//       extent,
//       featureProjection,
//     });
//     tile.setFeatures(features);
//   });
// };

let frameState, pixelRatio, rendererTransform;
const canvas = new OffscreenCanvas(1, 1);
// OffscreenCanvas does not have a style, so we mock it
canvas.style = {};
const context = canvas.getContext('2d');
console.log('OK');

const latarnieId = 63;

const maxZoomVectorImage = 22;
const tileGrid = createXYZ({
  tileSize: 512,
  maxZoom: maxZoomVectorImage,
});

let sourceLat;
sourceLat = new VectorTileSource({
  maxZoom: 15,
  format: new MVT({
    idProperty: 'iso_a3',
    featureClass: Feature,
  }),
  url: 'https://aquagis3-dev.gis.support/api/vtiles/63/{z}/{x}/{y}.pbf',
  // 'https://ahocevar.com/geoserver/gwc/service/tms/1.0.0/' +
  // 'ne:ne_10m_admin_0_countries@EPSG%3A900913@pbf/{z}/{x}/{-y}.pbf',
});
const layers = [];

function loadStyles() {
  const source = sourceLat;
  if (!source) {
    return;
  }
  const layer = new VectorTileLayer({
    declutter: false,
    source,
    style: new Style({
      // text: new Text({
      //   text: 'test',
      // }),
      image: new Circle({
        radius: 5,
        fill: new Fill({
          color: 'red',
        }),
      }),
    }),
    minZoom: source.getTileGrid().getMinZoom(),
  });
  layer.getRenderer().useContainer = function (target, transform) {
    this.containerReused = this.getLayer() !== layers[0];
    this.canvas = canvas;
    this.context = context;
    this.container = {
      firstElementChild: canvas,
      style: {
        opacity: layer.getOpacity(),
      },
    };
    rendererTransform = transform;
  };
  layers.push(layer);
  worker.postMessage({action: 'requestRender'});
}

// Minimal map-like functionality for rendering
const tileQueue = new TileQueue(
  (tile, tileSourceKey, tileCenter, tileResolution) =>
    tilePriorityFunction(
      frameState,
      tile,
      tileSourceKey,
      tileCenter,
      tileResolution,
    ),
  () => worker.postMessage({action: 'requestRender'}),
);

const maxTotalLoading = 8;
const maxNewLoads = 2;

worker.addEventListener('message', (event) => {
  if (event.data.action !== 'render') {
    return;
  }
  frameState = event.data.frameState;
  if (!pixelRatio) {
    pixelRatio = frameState.pixelRatio;
    loadStyles();
  }
  frameState.tileQueue = tileQueue;
  frameState.viewState.projection = get('EPSG:3857');
  frameState.layerStatesArray = layers.map((l) => l.getLayerState());
  layers.forEach((layer) => {
    if (inView(layer.getLayerState(), frameState.viewState)) {
      if (layer.getDeclutter() && !frameState.declutterTree) {
        frameState.declutter = {};
      }
      const renderer = layer.getRenderer();
      renderer.renderFrame(frameState, canvas);
    }
  });
  layers.forEach((layer) => {
    if (!layer.getRenderer().context) {
      return;
    }
    // layer.renderDeclutter(frameState, layer.getLayerState());
    layer.renderDeferred(frameState);
  });
  frameState.postRenderFunctions.forEach((fn) => fn(null, frameState));
  if (tileQueue.getTilesLoading() < maxTotalLoading) {
    tileQueue.reprioritize();
    tileQueue.loadMoreTiles(maxTotalLoading, maxNewLoads);
  }
  const imageData = canvas.transferToImageBitmap();
  worker.postMessage(
    {
      action: 'rendered',
      imageData: imageData,
      transform: rendererTransform,
      frameState: {
        viewState: {
          center: frameState.viewState.center.slice(0),
          resolution: frameState.viewState.resolution,
          rotation: frameState.viewState.rotation,
        },
        pixelRatio: frameState.pixelRatio,
        size: frameState.size.slice(0),
        extent: frameState.extent.slice(0),
        coordinateToPixelTransform:
          frameState.coordinateToPixelTransform.slice(0),
        pixelToCoordinateTransform:
          frameState.pixelToCoordinateTransform.slice(0),
      },
    },
    [imageData],
  );
});
