import ngeohash from 'ngeohash';

const DEFAULT_PRECISION = parseInt(process.env.GEOHASH_PRECISION || '7');

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoBoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export function encodeGeohash(lat: number, lng: number, precision: number = DEFAULT_PRECISION): string {
  return ngeohash.encode(lat, lng, precision);
}

export function decodeGeohash(geohash: string): GeoPoint {
  const decoded = ngeohash.decode(geohash);
  return {
    lat: decoded.latitude,
    lng: decoded.longitude,
  };
}

export function getGeohashBoundingBox(geohash: string): GeoBoundingBox {
  const bounds = ngeohash.decode_bbox(geohash);
  return {
    minLat: bounds[0],
    minLng: bounds[1],
    maxLat: bounds[2],
    maxLng: bounds[3],
  };
}

export function getNeighbors(geohash: string): string[] {
  return ngeohash.neighbors(geohash);
}

export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371e3;
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function getGeohashesForRadius(lat: number, lng: number, radiusInMeters: number): string[] {
  let precision = DEFAULT_PRECISION;
  
  if (radiusInMeters > 5000) precision = 5;
  else if (radiusInMeters > 1000) precision = 6;
  else if (radiusInMeters > 100) precision = 7;
  else precision = 8;

  const centerGeohash = encodeGeohash(lat, lng, precision);
  const neighbors = getNeighbors(centerGeohash);
  
  return [centerGeohash, ...neighbors];
}

export function filterByDistance<T extends { location: { lat: number; lng: number } }>(
  items: T[],
  center: GeoPoint,
  radiusInMeters: number
): T[] {
  return items.filter(item => {
    const distance = calculateDistance(center, {
      lat: item.location.lat,
      lng: item.location.lng,
    });
    return distance <= radiusInMeters;
  });
}
