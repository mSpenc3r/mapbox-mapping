import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1Ijoic3BlbmNtYSIsImEiOiJjbHU0bjNmajQxYXM5MnBvdDhtZGs1cGIxIn0.LiwtgMDd2EPJCoQfYCcwsQ';

const MapboxThreeIntegration = () => {
  const mapContainerRef = useRef(null);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-71.0589, 42.3601],
      zoom: 11,
      pitch: 45,
      bearing: 0,
      antialias: true,
    });

    map.on('load', async () => {
      const geoJsonUrl = `${process.env.PUBLIC_URL}/polygons.json`;
      const response = await fetch(geoJsonUrl);
      const data = await response.json();

      map.addSource('zipcodes', {
        type: 'geojson',
        data: data
      });

      // Add the layer for zipcodes here if needed
      map.addLayer({
        id: 'zipcode-depth-layer',
        type: 'fill-extrusion',
        source: 'zipcodes',
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'fraction_nonwhite'],
            0, '#caf0f8',
            20, '#90e0ef',
            40, '#00b4d8',
            60, '#0077b6',
            80, '#03045e',
            100, '#000'
          ],
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['get', 'fraction_nonwhite'],
            0, 0,
            100, 10000 // Scale for extrusion height
          ],
          'fill-extrusion-opacity': 0.75
        }
      });

      const customLayer = {
        id: '3d-model',
        type: 'custom',
        renderingMode: '3d',
        onAdd: function(map, gl) {
          this.camera = new THREE.Camera();
          this.scene = new THREE.Scene();

          data.features.forEach(feature => {
            const centroid = feature.properties.centroid;
            const rCoiNat = feature.properties.r_coi_nat;
            const fractionNonwhite = feature.properties.fraction_nonwhite;
            const height = Math.max(0, Math.min(100, fractionNonwhite)) / 100 * 10000 + 500;

            const sphereGeometry = new THREE.SphereGeometry(105, 32, 32);
            const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFED });
            const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);

            const glowGeometry = new THREE.SphereGeometry(125, 32, 32);
            const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFED, transparent: true, opacity: 0.5 });
            const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);

            const mercator = mapboxgl.MercatorCoordinate.fromLngLat({
              lng: centroid[0],
              lat: centroid[1]
            }, height);
            const scale = mercator.meterInMercatorCoordinateUnits() * Math.pow(2, map.getZoom() - 10);

            [sphereMesh, glowMesh].forEach(mesh => {
              mesh.position.set(mercator.x, mercator.y, mercator.z);
              mesh.scale.set(scale, scale, scale);
              this.scene.add(mesh);
            });

            // Invisible marker for tooltip
            const el = document.createElement('div');
            el.style.width = '50px'; // Increase the size as needed
            el.style.height = '50px';
            el.style.borderRadius = '50%'; // Make it circular
            el.style.opacity = '0'; // Keep it invisible
            new mapboxgl.Marker(el, { offset: [-10, -10] }) // Half of width and height to center it
              .setLngLat(centroid)
              .setPopup(new mapboxgl.Popup({ offset: 25 })
              .setHTML(`<h3>RCOI NAT: ${rCoiNat}</h3>`))
               .addTo(map);

          });

          this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
          });
          this.renderer.autoClear = false;
        },
        render: function(gl, matrix) {
          const m = new THREE.Matrix4().fromArray(matrix);
          this.camera.projectionMatrix = m;
          this.renderer.resetState();
          this.renderer.render(this.scene, this.camera);
        }
      };

      map.addLayer(customLayer);
    });

    return () => map.remove();
  }, []);

  return <div ref={mapContainerRef} style={{ height: '100vh' }} />;
};

export default MapboxThreeIntegration;
