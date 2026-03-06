import ngeohash from 'ngeohash';

/**
 * Geohash precision levels and their approximate dimensions:
 * 1: ~5,000km x 5,000km
 * 2: ~1,250km x 625km
 * 3: ~156km x 156km
 * 4: ~39km x 19.5km
 * 5: ~4.9km x 4.9km
 * 6: ~1.2km x 0.6km
 * 7: ~152m x 152m
 * 8: ~38m x 19m
 * 9: ~4.8m x 4.8m
 */

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

/**
 * Encode a lat/lng coordinate to a geohash string
 */
export function encodeGeohash(lat: number, lng: number, precision: number = DEFAULT_PRECISION): string {
  return ngeohash.encode(lat, lng, precision);
}

/**
 * Decode a geohash to lat/lng coordinates
 */
export function decodeGeohash(geohash: string): GeoPoint {
  const decoded = ngeohash.decode(geohash);
  return {
    lat: decoded.latitude,
    lng: decoded.longitude,
  };
}

/**
 * Get the bounding box for a geohash
 */
export function getGeohashBoundingBox(geohash: string): GeoBoundingBox {
  const bounds = ngeohash.decode_bbox(geohash);
  return {
    minLat: bounds[0],
    minLng: bounds[1],
    maxLat: bounds[2],
    maxLng: bounds[3],
  };
}

/**
 * Get neighboring geohashes for a given geohash
 * Useful for querying around a point to ensure we capture all nearby missions
 */
export function getNeighbors(geohash: string): string[] {
  return ngeohash.neighbors(geohash);
}

/**
 * Calculate distance between two points in meters using Haversine formula
 */
export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371e3; // Earth's radius in meters
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

/**
 * Get geohashes to query for a given radius around a point
 * Returns an array of geohash prefixes to query
 */
export function getGeohashesForRadius(lat: number, lng: number, radiusInMeters: number): string[] {
  // Determine precision based on radius
  // We want to use a precision that gives us cells slightly smaller than our search radius
  let precision = DEFAULT_PRECISION;
  
  if (radiusInMeters > 5000) precision = 5;
  else if (radiusInMeters > 1000) precision = 6;
  else if (radiusInMeters > 100) precision = 7;
  else precision = 8;

  const centerGeohash = encodeGeohash(lat, lng, precision);
  const neighbors = getNeighbors(centerGeohash);
  
  // Include center and all neighbors to cover the search area
  return [centerGeohash, ...neighbors];
}

/**
 * Filter missions by actual distance from a point
 * Use this after querying by geohash to ensure only missions within radius are returned
 */
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
