      require([
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/FeatureLayer",
        "esri/widgets/Legend",
        "esri/layers/CSVLayer",
        "esri/widgets/FeatureTable",
        "esri/layers/GraphicsLayer",
        "esri/widgets/Sketch/SketchViewModel",
        "esri/Graphic",
        "esri/geometry/geometryEngineAsync"
      ], function (Map, MapView, FeatureLayer, Legend, CSVLayer, FeatureTable, GraphicsLayer, SketchViewModel, Graphic, geometryEngineAsync) {
        
        // Create FeatureLayer for states
        const statesLayer = new FeatureLayer({
          url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_State_Boundaries/FeatureServer/0",
          renderer: {
            type: "simple",
            symbol: {
              type: "simple-maker",
              color: "#f0ebe4",
              width: "2px",
              style: "solid",
              outline: {
                color: "#00ff",
                width: "0.5px"
              }
            }
          },
          spatialReference: {
            wkid: 102003
          },
          effect: "drop-shadow(-10px, 10px, 6px green)",
          outFields: ["*"],
          popupTemplate: {
            title: "{USA}",
            content: "Population: {POPULATION}"
          }
        });

        // Create CSVLayer
        const csvLayer = new CSVLayer({
          url: "https://ubatsukh.github.io/arcgis-js-api-demos/devsummit2021/csvLayer-nps/data/nps_establishments.csv",
          delimiter: ",",
          popupTemplate: {
            title: "{unit_name}",
            content: "Established on <b>{date_est}</b> <br/><br/> {description}"
          },
          renderer: setRenderer(),
          renderer: {
            type: "simple",
            symbol: {
              type: "simple-marker",
              color: "#00ff00",
              size: 8
            }
          }
        });

        let csvLayerView;
        csvLayer
          .when(() => {
            view.whenLayerView(csvLayer).then(function (layerView) {
              csvLayerView = layerView;
            });
          })
          .catch(errorCallback);

        // Create Map
        const map = new Map({
          basemap: "topo-vector",
          layers: [statesLayer, csvLayer]
        });

        // Create MapView
        const view = new MapView({
          container: "viewDiv",
          map: map,
          extent: {
            type: "extent",
            spatialReference: {
              wkid: 102003
            },
            xmax: 2275062,
            xmin: -2752064,
            ymax: 1676207,
            ymin: -1348080
          },
          constraints: {
            snapToZoom: false,
            minScale: 50465153
          },
          background: {
            color: "blue"
          },
          center: [-100, 40],
          zoom: 4
        });

        // Create Legend
        const legend = new Legend({
          view: view,
          layerInfos: [
            {
              layer: statesLayer,
              title: "US States"
            }
          ]
        });

        view.ui.add(legend, "bottom-right");

        // Create FeatureTable
        const featureTable = new FeatureTable({
          view: view,
          layer: csvLayer,
          tableTemplate: {
            columnTemplates: [
              { type: "field", fieldName: "unit_name", label: "Name" },
              { type: "field", fieldName: "state", label: "State" },
              { type: "field", fieldName: "region", label: "Region" },
              { type: "field", fieldName: "unit_type", label: "Type" },
              { type: "field", fieldName: "created_by", label: "Created by" },
              { type: "field", fieldName: "date_est", label: "Established date" },
              { type: "field", fieldName: "description", label: "Description" },
              { type: "field", fieldName: "caption", label: "Caption" }
            ]
          },
          container: document.getElementById("tableDiv")
        });

        // Array to keep track of selected feature objectIds
        let features = [];
        const highlightIds = [];

        // Check if highlights are being changed on the table
        featureTable.highlightIds.on("change", async (event) => {
          // Update the features array
          event.removed.forEach((item) => {
            const data = features.find((data) => data === item);
            if (data) {
              features.splice(features.indexOf(data), 1);
            }
          });

          // Add new features
          event.added.forEach((item) => {
            features.push(item);
          });

          csvLayerView.featureEffect = {
            filter: {
              objectIds: features
            },
            excludedEffect: "blur(5px) grayscale(90%) opacity(40%)"
          };
        });

        // Create GraphicsLayer for drawing shapes
        const polygonGraphicsLayer = new GraphicsLayer();
        map.add(polygonGraphicsLayer);

        // Add Select by Rectangle and Clear Selection buttons
        view.ui.add("select-by-rectangle", "top-left");
        view.ui.add("clear-selection", "top-left");
        const selectButton = document.getElementById("select-by-rectangle");
        const clearButton = document.getElementById("clear-selection");

        // Click event for Select by Rectangle button
        selectButton.addEventListener("click", () => {
          view.closePopup();
          sketchViewModel.create("rectangle");
        });

        // Click event for Clear Selection button
        clearButton.addEventListener("click", () => {
          featureTable.highlightIds.removeAll();
          featureTable.filterGeometry = null;
          polygonGraphicsLayer.removeAll();
        });

        // Create SketchViewModel
        const sketchViewModel = new SketchViewModel({
          view: view,
          layer: polygonGraphicsLayer
        });

        // Once user is done drawing a rectangle, use it to select features
        sketchViewModel.on("create", async (event) => {
            if (event.state === "complete") {
              // this polygon will be used to query features that intersect it
              const geometries = polygonGraphicsLayer.graphics.map(function (graphic) {
                return graphic.geometry;
              });
              const queryGeometry = await geometryEngineAsync.union(geometries.toArray());
              selectFeatures(queryGeometry);
            }
          });

        // Function to select features based on geometry
        function selectFeatures(geometry) {
          if (csvLayerView) {
            const query = {
              geometry: geometry,
              outFields: ["*"]
            };

            csvLayerView
              .queryFeatures(query)
              .then((results) => {
                if (results.features.length === 0) {
                  clearSelection();
                } else {
                  // filter the table based on the selection and only show those rows
                  featureTable.filterGeometry = geometry;
                  // Iterate through the features and push each individual result's OBJECTID to the highlightIds array
                  results.features.forEach((feature) => {
                    highlightIds.push(feature.attributes.__OBJECTID);
                  });
                  // Set the highlightIds array to the highlightIds property of the featureTable
                  featureTable.highlightIds.addMany(highlightIds);
                }
              })
              .catch(errorCallback);
          }
        }

        // Function to handle errors
        function errorCallback(error) {
          console.log("error happened:", error.message);
        }
        function setRenderer() {
          return {
            type: "simple",
            symbol: {
              type: "cim",
              data: {
                type: "CIMSymbolReference",
                symbol: {
                  type: "CIMPointSymbol",
                  symbolLayers: [
                    {
                      type: "CIMVectorMarker",
                      enable: true,
                      anchorPointUnits: "Relative",
                      dominantSizeAxis3D: "Y",
                      size: 15.75,
                      billboardMode3D: "FaceNearPlane",
                      frame: {
                        xmin: 0,
                        ymin: 0,
                        xmax: 21,
                        ymax: 21
                      },
                      markerGraphics: [
                        {
                          type: "CIMMarkerGraphic",
                          geometry: {
                            rings: [
                              [
                                [15, 15],
                                [12, 15],
                                [16, 10],
                                [13, 10],
                                [17, 5],
                                [11, 5],
                                [11, 2],
                                [10, 2],
                                [10, 5],
                                [4, 5],
                                [8, 10],
                                [5, 10],
                                [9, 15],
                                [6, 15],
                                [10.5, 19],
                                [15, 15]
                              ]
                            ]
                          },
                          symbol: {
                            type: "CIMPolygonSymbol",
                            symbolLayers: [
                              {
                                type: "CIMSolidStroke",
                                enable: true,
                                capStyle: "Round",
                                joinStyle: "Round",
                                lineStyle3D: "Strip",
                                miterLimit: 10,
                                width: 0,
                                color: [0, 0, 0, 255]
                              },
                              {
                                type: "CIMSolidFill",
                                enable: true,
                                color: [0, 160, 0, 255]
                              }
                            ]
                          }
                        }
                      ],
                      scaleSymbolsProportionally: true,
                      respectFrame: true
                    },
                    {
                      type: "CIMVectorMarker",
                      enable: true,
                      colorLocked: true,
                      anchorPointUnits: "Relative",
                      dominantSizeAxis3D: "Y",
                      size: 8,
                      billboardMode3D: "FaceNearPlane",
                      frame: {
                        xmin: -5,
                        ymin: -5,
                        xmax: 5,
                        ymax: 5
                      },
                      markerGraphics: [
                        {
                          type: "CIMMarkerGraphic",
                          geometry: {
                            rings: [
                              [
                                [0, 5],
                                [0.87, 4.92],
                                [1.71, 4.7],
                                [2.5, 4.33],
                                [3.21, 3.83],
                                [3.83, 3.21],
                                [4.33, 2.5],
                                [4.7, 1.71],
                                [4.92, 0.87],
                                [5, 0],
                                [4.92, -0.87],
                                [4.7, -1.71],
                                [4.33, -2.5],
                                [3.83, -3.21],
                                [3.21, -3.83],
                                [2.5, -4.33],
                                [1.71, -4.7],
                                [0.87, -4.92],
                                [0, -5],
                                [-0.87, -4.92],
                                [-1.71, -4.7],
                                [-2.5, -4.33],
                                [-3.21, -3.83],
                                [-3.83, -3.21],
                                [-4.33, -2.5],
                                [-4.7, -1.71],
                                [-4.92, -0.87],
                                [-5, 0],
                                [-4.92, 0.87],
                                [-4.7, 1.71],
                                [-4.33, 2.5],
                                [-3.83, 3.21],
                                [-3.21, 3.83],
                                [-2.5, 4.33],
                                [-1.71, 4.7],
                                [-0.87, 4.92],
                                [0, 5]
                              ]
                            ]
                          },
                          symbol: {
                            type: "CIMPolygonSymbol",
                            symbolLayers: [
                              {
                                type: "CIMSolidStroke",
                                enable: true,
                                capStyle: "Round",
                                joinStyle: "Round",
                                lineStyle3D: "Strip",
                                miterLimit: 10,
                                width: 0.5,
                                color: [167, 169, 172, 255]
                              },
                              {
                                type: "CIMSolidFill",
                                enable: true,
                                color: [255, 255, 255, 255]
                              }
                            ]
                          }
                        }
                      ],
                      scaleSymbolsProportionally: true,
                      respectFrame: true
                    }
                  ],
                  haloSize: 1,
                  scaleX: 1,
                  angleAlignment: "Display"
                }
              }
            }
          };
        }
      });
  

