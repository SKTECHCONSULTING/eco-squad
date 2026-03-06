'use client';

import * as React from 'react';
import Link from 'next/link';
import { Mission, MissionType, MissionStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { calculateDistance, formatDistance } from '@/lib/utils';

interface MissionCardProps {
  mission: Mission;
  userLocation?: { lat: number; lng: number };
  onClaim?: (missionId: string) => void;
  isClaiming?: boolean;
}

const missionTypeLabels: Record<MissionType, string> = {
  LITTER_COLLECTION: 'Litter Collection',
  TREE_PLANTING: 'Tree Planting',
  BIO_DIVERSITY: 'Biodiversity',
  WATER_QUALITY: 'Water Quality',
  RECYCLING: 'Recycling',
  RESTORATION: 'Restoration',
};

const missionTypeIcons: Record<MissionType, string> = {
  LITTER_COLLECTION: '🗑️',
  TREE_PLANTING: '🌳',
  BIO_DIVERSITY: '🦋',
  WATER_QUALITY: '💧',
  RECYCLING: '♻️',
  RESTORATION: '🌱',
};

const statusVariants: Record<MissionStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  AVAILABLE: 'success',
  CLAIMED: 'warning',
  IN_PROGRESS: 'default',
  PENDING_VERIFICATION: 'secondary',
  COMPLETED: 'default',
  EXPIRED: 'destructive',
};

export function MissionCard({ mission, userLocation, onClaim, isClaiming }: MissionCardProps) {
  const distance = userLocation
    ? calculateDistance(
        userLocation.lat,
        userLocation.lng,
        mission.location.lat,
        mission.location.lng
      )
    : null;

  const isAvailable = mission.status === 'AVAILABLE';
  const expiresSoon = mission.expiresAt
    ? new Date(mission.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000
    : false;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {missionTypeIcons[mission.type]} {missionTypeLabels[mission.type]}
              </Badge>
              <Badge variant={statusVariants[mission.status]} className="text-xs">
                {mission.status.replace(/_/g, ' ')}
              </Badge>
              {expiresSoon && isAvailable && (
                <Badge variant="destructive" className="text-xs">
                  Expires Soon
                </Badge>
              )}
            </div>

            <Link
              href={`/missions/${mission.id}`}
              className="block mt-2 hover:text-primary-600 transition-colors"
            >
              <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
                {mission.title}
              </h3>
            </Link>

            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
              {mission.description}
            </p>

            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              {distance !== null && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {formatDistance(distance)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {mission.impactPoints} points
              </span>
              {mission.tags.length > 0 && (
                <span className="hidden sm:flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  {mission.tags.slice(0, 2).join(', ')}
                  {mission.tags.length > 2 && ` +${mission.tags.length - 2}`}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {isAvailable ? (
              <Button
                size="sm"
                onClick={() => onClaim?.(mission.id)}
                isLoading={isClaiming}
              >
                Claim
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                {mission.status === 'CLAIMED' ? 'Claimed' : 'Unavailable'}
              </Button>
            )}
            <Link
              href={`/missions/${mission.id}`}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Details →
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
