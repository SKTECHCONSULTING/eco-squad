'use client';

import * as React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Mission } from '@/types';
import { formatDistance, calculateDistance } from '@/lib/utils';
import { Badge } from '../ui/Badge';
import Link from 'next/link';

// Fix for default marker icons in Leaflet with Next.js
const defaultIcon = new Icon({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const userIcon = new Icon({
  iconUrl: '/marker-user.png',
  iconRetinaUrl: '/marker-user-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface MapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  missions?: Mission[];
  userLocation?: { lat: number; lng: number };
  radius?: number;
  onMissionClick?: (mission: Mission) => void;
  height?: string;
  interactive?: boolean;
}

// Map controller to handle programmatic map updates
function MapController({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center, map]);
  return null;
}

export function MissionMap({
  center,
  zoom = 13,
  missions = [],
  userLocation,
  radius,
  onMissionClick,
  height = '400px',
  interactive = true,
}: MapProps) {
  const getMissionIcon = (type: string) => {
    const colors: Record<string, string> = {
      LITTER_COLLECTION: '#22c55e',
      TREE_PLANTING: '#16a34a',
      BIO_DIVERSITY: '#3b82f6',
      WATER_QUALITY: '#06b6d4',
      RECYCLING: '#f59e0b',
      RESTORATION: '#8b5cf6',
    };

    return new Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${colors[type] || '#22c55e'}" width="30" height="30"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`
      )}`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30],
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
      AVAILABLE: 'success',
      CLAIMED: 'warning',
      IN_PROGRESS: 'default',
      PENDING_VERIFICATION: 'secondary',
      COMPLETED: 'default',
      EXPIRED: 'destructive',
    };
    return variants[status] || 'default';
  };

  return (
    <div style={{ height, width: '100%' }} className="rounded-xl overflow-hidden border border-gray-200">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={center} />

        {/* User location marker */}
        {userLocation && (
          <>
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={userIcon}
            />
            {radius && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={radius}
                pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.1 }}
              />
            )}
          </>
        )}

        {/* Mission markers */}
        {missions.map((mission) => (
          <Marker
            key={mission.id}
            position={[mission.location.lat, mission.location.lng]}
            icon={getMissionIcon(mission.type)}
            eventHandlers={{
              click: () => onMissionClick?.(mission),
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-semibold text-gray-900">{mission.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {mission.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={getStatusBadge(mission.status)}>
                    {mission.status}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {userLocation &&
                      formatDistance(
                        calculateDistance(
                          userLocation.lat,
                          userLocation.lng,
                          mission.location.lat,
                          mission.location.lng
                        )
                      )}
                  </span>
                </div>
                <div className="mt-3">
                  <Link
                    href={`/missions/${mission.id}`}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// Simple map component for mission detail page
export function SimpleMap({
  center,
  zoom = 15,
  height = '200px',
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  height?: string;
}) {
  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[center.lat, center.lng]} icon={defaultIcon} />
      </MapContainer>
    </div>
  );
}
