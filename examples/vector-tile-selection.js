import MVT from '../src/ol/format/MVT.js';
import Map from '../src/ol/Map.js';
import OSM from '../src/ol/source/OSM.js';
import TileLayer from '../src/ol/layer/Tile.js';
import VectorTileLayer from '../src/ol/layer/VectorTile.js';
import VectorTileSource from '../src/ol/source/VectorTile.js';
import View from '../src/ol/View.js';
import {Fill, Stroke, Style, Circle} from '../src/ol/style.js';
import {getBottomLeft, getHeight, getWidth} from 'ol/extent.js';
import Feature from '../src/ol/Feature.js';
import Worker from 'worker-loader!./worker.js'; //eslint-disable-line
import { compose, create, toString as toTransformString } from 'ol/transform.js';
import {toContext} from 'ol/render.js';

const worker = new Worker();

let container,
  transformContainer,
  canvas,
  rendering,
  workerFrameState,
  mainThreadFrameState;

// Transform the container to account for the difference between the (newer)
// main thread frameState and the (older) worker frameState
function updateContainerTransform() {
  if (workerFrameState) {
    const viewState = mainThreadFrameState.viewState;
    const renderedViewState = workerFrameState.viewState;
    const center = viewState.center;
    const resolution = viewState.resolution;
    const rotation = viewState.rotation;
    const renderedCenter = renderedViewState.center;
    const renderedResolution = renderedViewState.resolution;
    const renderedRotation = renderedViewState.rotation;
    const transform = create();
    // Skip the extra transform for rotated views, because it will not work
    // correctly in that case
    if (!rotation) {
      compose(
        transform,
        (renderedCenter[0] - center[0]) / resolution,
        (center[1] - renderedCenter[1]) / resolution,
        renderedResolution / resolution,
        renderedResolution / resolution,
        rotation - renderedRotation,
        0,
        0,
      );
    } else {
      compose(
        transform,
        0,
        0,
        renderedResolution / resolution,
        renderedResolution / resolution,
        rotation - renderedRotation,
        0,
        0,
      );
    }
    transformContainer.style.transform = toTransformString(transform);
  }
}

// lookup for selection objects
// let selection = {};

// const country = new Style({
//   stroke: new Stroke({
//     color: 'gray',
//     width: 1,
//   }),
//   fill: new Fill({
//     color: 'rgba(20,20,20,0.9)',
//   }),
// });
// const selectedCountry = new Style({
//   stroke: new Stroke({
//     color: 'rgba(200,20,20,0.8)',
//     width: 2,
//   }),
//   fill: new Fill({
//     color: 'rgba(200,20,20,0.4)',
//   }),
// });

const vtLayerBase = new VectorTileLayer({
  declutter: false,
  renderMode: 'vector',
  // style: new Style({
  //   hitDetectionRenderer(pixelCoordinates, state) {
  //     const context = state.context;
  //     const geometry = state.geometry.clone();
  //     geometry.setCoordinates(pixelCoordinates);
  //     context.save();
  //     const renderContext = toContext(context, {
  //       pixelRatio: 1,
  //     });
  //     // renderContext.setFil;
  //     renderContext.drawGeometry(geometry);
  //     context.restore();
  //   },
  // }),
  source: new VectorTileSource({
    maxZoom: 15,
    format: new MVT({
      idProperty: 'iso_a3',
      featureClass: Feature,
    }),
    tileLoadFunction: function (tile) {
      tile.setLoader(async (extent, resolution, featureProjection) => {
        let responseArrayBuffer;
        const [z, x, y] = tile.tileCoord;
        const r = await fetch(`https://aquagis3-dev.gis.support/api/vtiles/63/${z}/${x}/${y}.pbf`);
        responseArrayBuffer = await r.arrayBuffer();
        const features = tile.getFormat().readFeatures(responseArrayBuffer, {
          extent,
          featureProjection,
        });
        console.log(features);
        tile.setFeatures(features);
      });
    },
    url: 'https://aquagis3-dev.gis.support/api/vtiles/63/{z}/{x}/{y}.pbf',
  }),
});

const vtLayer = new VectorTileLayer({
  declutter: false,
  renderMode: 'vector',
  render: function (frameState) {
    if (!container) {
      container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.width = '100%';
      container.style.height = '100%';
      transformContainer = document.createElement('div');
      transformContainer.style.position = 'absolute';
      transformContainer.style.width = '100%';
      transformContainer.style.height = '100%';
      container.appendChild(transformContainer);
      canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.transformOrigin = 'top left';
      transformContainer.appendChild(canvas);
    }
    mainThreadFrameState = frameState;
    updateContainerTransform();
    if (!rendering) {
      rendering = true;
      worker.postMessage({
        action: 'render',
        frameState: {
          layerIndex: 0,
          wantedTiles: {},
          usedTiles: {},
          viewHints: frameState.viewHints.slice(0),
          postRenderFunctions: [],
          viewState: {
            center: frameState.viewState.center.slice(0),
            resolution: frameState.viewState.resolution,
            rotation: frameState.viewState.rotation,
            zoom: frameState.viewState.zoom,
          },
          pixelRatio: frameState.pixelRatio,
          size: frameState.size.slice(0),
          extent: frameState.extent.slice(0),
          coordinateToPixelTransform:
            frameState.coordinateToPixelTransform.slice(0),
          pixelToCoordinateTransform:
            frameState.pixelToCoordinateTransform.slice(0),
          layerStatesArray: frameState.layerStatesArray.map((l) => ({
            zIndex: l.zIndex,
            visible: l.visible,
            extent: l.extent,
            maxResolution: l.maxResolution,
            minResolution: l.minResolution,
            sourceState: l.sourceState,
            managed: l.managed,
          })),
        },
      });
    } else {
      frameState.animate = true;
    }
    return container;
    // return frameState;
  },
  source: new VectorTileSource({
    maxZoom: 15,
    format: new MVT({
      idProperty: 'iso_a3',
      featureClass: Feature,
    }),
    tileLoadFunction: function (tile) {
      tile.setLoader(async (extent, resolution, featureProjection) => {
        let responseArrayBuffer;
        const [z, x, y] = tile.tileCoord;
        const r = await fetch(`https://aquagis3-dev.gis.support/api/vtiles/63/${z}/${x}/${y}.pbf`);
        responseArrayBuffer = await r.arrayBuffer();
        const features = tile.getFormat().readFeatures(responseArrayBuffer, {
          extent,
          featureProjection,
        });
        console.log(features);
        tile.setFeatures(features);
      });
    },
    url: 'https://aquagis3-dev.gis.support/api/vtiles/63/{z}/{x}/{y}.pbf',
  }),
});

const map = new Map({
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    // vtLayerBase,
    vtLayer,
  ],
  target: 'map',
  view: new View({
    center: [2336277.818634676, 6839933.167533613],
    zoom: 14,
    multiWorld: true,
  }),
});

worker.addEventListener('message', message => {
  if (message.data.action === 'getFeatures') {
    // showInfo(message.data.features);
  } else if (message.data.action === 'requestRender') {
    // Worker requested a new render frame
    map.render();
  } else if (canvas && message.data.action === 'rendered') {
    // Worker provides a new render frame
    requestAnimationFrame(function () {
      const imageData = message.data.imageData;
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      canvas.getContext('2d').drawImage(imageData, 0, 0);
      canvas.style.transform = message.data.transform;
      workerFrameState = message.data.frameState;
      updateContainerTransform();
    });
    rendering = false;
  }
});

map.on('click', (e) => {
  map.forEachFeatureAtPixel(e.pixel, f => {
    console.log(f);
  });
})

console.log('ok'); // eslint-disable-line no-console

// Selection
// const selectionLayer = new VectorTileLayer({
//   map: map,
//   renderMode: 'image',
//   source: vtLayer.getSource(),
//   style: function (feature) {
//     if (feature.getId() in selection) {
//       return selectedCountry;
//     }
//   },
// });

// const selectElement = document.getElementById('type');

// map.on(['click', 'pointermove'], function (event) {
//   if (
//     (selectElement.value === 'singleselect-hover' &&
//       event.type !== 'pointermove') ||
//     (selectElement.value !== 'singleselect-hover' &&
//       event.type === 'pointermove')
//   ) {
//     return;
//   }
//   vtLayer.getFeatures(event.pixel).then(function (features) {
//     if (!features.length) {
//       selection = {};
//       selectionLayer.changed();
//       return;
//     }
//     const feature = features[0];
//     if (!feature) {
//       return;
//     }
//     const fid = feature.getId();

//     if (selectElement.value.startsWith('singleselect')) {
//       selection = {};
//     }
//     // add selected feature to lookup
//     selection[fid] = feature;

//     selectionLayer.changed();
//   });
// });
