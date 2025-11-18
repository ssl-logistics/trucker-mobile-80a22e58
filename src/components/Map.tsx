import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';

interface MapProps {
  latitude: number;
  longitude: number;
  markerLabel?: string;
  showRoute?: boolean;
}

const Map: React.FC<MapProps> = ({ latitude, longitude, markerLabel, showRoute = false }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const routingControl = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Get user's current location
    if (showRoute && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }

    // Initialize map
    map.current = L.map(mapContainer.current).setView([latitude, longitude], 15);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map.current);

    // Create custom marker icon
    const customIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add destination marker
    const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map.current);

    if (markerLabel) {
      marker.bindPopup(`<div class="p-2 font-medium">${markerLabel}</div>`);
    }

    // Add user location marker and routing if enabled
    if (showRoute && userLocation && map.current) {
      // Custom icon for user location
      const userIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0iIzM0OTZGRiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI1IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      // Add user location marker
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map.current)
        .bindPopup('<div class="p-2 font-medium">ตำแหน่งของคุณ</div>');

      // Add routing
      routingControl.current = (L as any).Routing.control({
        waypoints: [
          L.latLng(userLocation.lat, userLocation.lng),
          L.latLng(latitude, longitude)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
        lineOptions: {
          styles: [{ color: '#3b82f6', opacity: 0.8, weight: 5 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        createMarker: () => null, // Hide default markers
      }).addTo(map.current);
    }

    // Cleanup
    return () => {
      if (routingControl.current) {
        routingControl.current.remove();
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [latitude, longitude, markerLabel, showRoute, userLocation]);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-48 rounded-lg"
      style={{ zIndex: 0 }}
    />
  );
};

export default Map;
