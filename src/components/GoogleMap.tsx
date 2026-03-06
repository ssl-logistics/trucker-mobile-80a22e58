/// <reference types="@types/google.maps" />

import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

declare global {
  interface Window {
    google: typeof google;
  }
}

// Cache for Directions API results
const directionsCache = new Map<string, google.maps.DirectionsResult>();

function getDirectionsCacheKey(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): string {
  // Round to 4 decimal places (~11m precision) to allow minor GPS drift
  const oLat = origin.lat.toFixed(4);
  const oLng = origin.lng.toFixed(4);
  const dLat = destination.lat.toFixed(4);
  const dLng = destination.lng.toFixed(4);
  return `${oLat},${oLng}->${dLat},${dLng}`;
}

interface GoogleMapProps {
  latitude: number;
  longitude: number;
  markerLabel?: string;
  showRoute?: boolean;
}

const GoogleMap: React.FC<GoogleMapProps> = ({ latitude, longitude, markerLabel, showRoute = false }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  // Load Google Maps Script
  useEffect(() => {
    const loadGoogleMaps = async () => {
      // Check if already loaded
      if (window.google?.maps) {
        setIsLoaded(true);
        return;
      }

      try {
        // Fetch API key from edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-google-maps-key`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch Google Maps API key');
        }

        const { apiKey } = await response.json();

        if (!apiKey) {
          throw new Error('Google Maps API key not available');
        }

        // Load the script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => setIsLoaded(true);
        script.onerror = () => setError('Failed to load Google Maps');
        document.head.appendChild(script);
      } catch (err) {
        console.error('Error loading Google Maps:', err);
        setError(err instanceof Error ? err.message : 'Failed to load Google Maps');
      }
    };

    loadGoogleMaps();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapContainer.current || mapRef.current) return;

    const destination = { lat: latitude, lng: longitude };

    mapRef.current = new window.google.maps.Map(mapContainer.current, {
      center: destination,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    // Add destination marker
    const marker = new window.google.maps.Marker({
      position: destination,
      map: mapRef.current,
      title: markerLabel || 'Destination',
      icon: {
        url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
        scaledSize: new window.google.maps.Size(40, 40),
      },
    });

    // Add info window
    if (markerLabel) {
      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div style="padding: 8px; font-weight: 500;">${markerLabel}</div>`,
      });
      marker.addListener('click', () => {
        infoWindow.open(mapRef.current, marker);
      });
    }

    // Show route if enabled
    if (showRoute && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const origin = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          // Add user location marker
          new window.google.maps.Marker({
            position: origin,
            map: mapRef.current!,
            title: t('map.yourLocation'),
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 3,
            },
          });

          // Get directions
          const directionsService = new window.google.maps.DirectionsService();
          directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#4285F4',
              strokeWeight: 5,
              strokeOpacity: 0.8,
            },
          });

          const cacheKey = getDirectionsCacheKey(origin, destination);
          const cachedResult = directionsCache.get(cacheKey);

          if (cachedResult) {
            console.log('[GoogleMap] Using cached directions for:', cacheKey);
            directionsRendererRef.current?.setDirections(cachedResult);
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(origin);
            bounds.extend(destination);
            mapRef.current?.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
          } else {
            directionsService.route(
              {
                origin: origin,
                destination: destination,
                travelMode: window.google.maps.TravelMode.DRIVING,
              },
              (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK && result) {
                  directionsCache.set(cacheKey, result);
                  console.log('[GoogleMap] Cached new directions for:', cacheKey);
                  directionsRendererRef.current?.setDirections(result);
                  
                  const bounds = new window.google.maps.LatLngBounds();
                  bounds.extend(origin);
                  bounds.extend(destination);
                  mapRef.current?.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
                } else {
                  console.error('Directions request failed:', status);
                }
              }
            );
          }
        },
        (err) => {
          console.error('Error getting user location:', err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
      mapRef.current = null;
    };
  }, [isLoaded, latitude, longitude, markerLabel, showRoute, t]);

  if (error) {
    return (
      <div className="w-full h-48 rounded-lg bg-muted flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-48 rounded-lg bg-muted flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className="w-full h-48 rounded-lg"
      style={{ zIndex: 0 }}
    />
  );
};

export default GoogleMap;
