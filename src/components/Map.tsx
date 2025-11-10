import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MapProps {
  latitude: number;
  longitude: number;
  markerLabel?: string;
}

const Map: React.FC<MapProps> = ({ latitude, longitude, markerLabel }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [token, setToken] = useState(localStorage.getItem('mapbox_token') || '');
  const [isTokenSet, setIsTokenSet] = useState(!!localStorage.getItem('mapbox_token'));

  const handleSetToken = () => {
    if (token) {
      localStorage.setItem('mapbox_token', token);
      setIsTokenSet(true);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || !isTokenSet) return;

    const savedToken = localStorage.getItem('mapbox_token');
    if (!savedToken) return;

    mapboxgl.accessToken = savedToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [longitude, latitude],
      zoom: 15,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl(),
      'top-right'
    );

    // Add marker
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.width = '30px';
    el.style.height = '30px';
    el.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
    el.style.backgroundSize = 'cover';

    marker.current = new mapboxgl.Marker(el)
      .setLngLat([longitude, latitude])
      .addTo(map.current);

    if (markerLabel) {
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`<div class="p-2 font-medium">${markerLabel}</div>`);
      marker.current.setPopup(popup);
    }

    return () => {
      marker.current?.remove();
      map.current?.remove();
    };
  }, [latitude, longitude, markerLabel, isTokenSet]);

  if (!isTokenSet) {
    return (
      <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-3">
          <p className="text-sm text-center text-muted-foreground mb-2">
            ใส่ Mapbox Public Token เพื่อแสดงแผนที่
            <br />
            <a 
              href="https://account.mapbox.com/access-tokens/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline text-xs"
            >
              รับ token ที่นี่
            </a>
          </p>
          <Input
            type="text"
            placeholder="pk.eyJ1..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full"
          />
          <Button onClick={handleSetToken} className="w-full">
            บันทึก Token
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className="w-full h-48 rounded-lg" />
  );
};

export default Map;
