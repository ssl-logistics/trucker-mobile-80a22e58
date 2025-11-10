import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon issue with webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  latitude: number;
  longitude: number;
  markerLabel?: string;
}

const Map: React.FC<MapProps> = ({ latitude, longitude, markerLabel }) => {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={15}
      style={{ height: '192px', width: '100%', borderRadius: '0.5rem' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]}>
        {markerLabel && (
          <Popup>
            <div className="p-1 font-medium">{markerLabel}</div>
          </Popup>
        )}
      </Marker>
    </MapContainer>
  );
};

export default Map;
