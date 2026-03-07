'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mission } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { SimpleMap } from '@/components/maps/MissionMap';
import { Layout, Container } from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';

const missionTypeLabels: Record<string, string> = {
  LITTER_COLLECTION: 'Litter Collection',
  TREE_PLANTING: 'Tree Planting',
  BIO_DIVERSITY: 'Biodiversity',
  WATER_QUALITY: 'Water Quality',
  RECYCLING: 'Recycling',
  RESTORATION: 'Restoration',
};

const missionTypeIcons: Record<string, string> = {
  LITTER_COLLECTION: '🗑️',
  TREE_PLANTING: '🌳',
  BIO_DIVERSITY: '🦋',
  WATER_QUALITY: '💧',
  RECYCLING: '♻️',
  RESTORATION: '🌱',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  AVAILABLE: 'success',
  CLAIMED: 'warning',
  IN_PROGRESS: 'default',
  PENDING_VERIFICATION: 'secondary',
  COMPLETED: 'default',
  EXPIRED: 'destructive',
};

export default function MissionDetailClient() {
  const params = useParams();
  const router = useRouter();
  const missionId = params.id as string;

  const [mission, setMission] = React.useState<Mission | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isClaiming, setIsClaiming] = React.useState(false);
  const [showClaimModal, setShowClaimModal] = React.useState(false);

  React.useEffect(() => {
    const fetchMission = async () => {
      try {
        const response = await fetch(`/api/missions/${missionId}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/missions');
            return;
          }
          throw new Error('Failed to fetch mission');
        }
        const data = await response.json();
        setMission(data.mission);
      } catch (error) {
        toast.error('Failed to load mission details');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    if (missionId) {
      fetchMission();
    }
  }, [missionId, router]);

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      const response = await fetch(`/api/missions/${missionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId: 'default' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to claim mission');
      }

      toast.success('Mission claimed successfully!');
      setShowClaimModal(false);
      
      // Refresh mission data
      const updatedResponse = await fetch(`/api/missions/${missionId}`);
      const data = await updatedResponse.json();
      setMission(data.mission);
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim mission');
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <Container className="py-8">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-4 w-96 mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-64" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-48" />
              </div>
            </div>
          </div>
        </Container>
      </Layout>
    );
  }

  if (!mission) {
    return (
      <Layout>
        <Container className="py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-gray-900">Mission not found</h1>
            <p className="text-gray-600 mt-2">The mission you&apos;re looking for doesn&apos;t exist.</p>
            <Link href="/missions" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
              ← Back to missions
            </Link>
          </div>
        </Container>
      </Layout>
    );
  }

  const isAvailable = mission.status === 'AVAILABLE';
  const isClaimed = mission.status === 'CLAIMED' || mission.status === 'IN_PROGRESS';
  const isCompleted = mission.status === 'COMPLETED';

  return (
    <Layout>
      <Container className="py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
            <Link href="/missions" className="hover:text-gray-900">
              Missions
            </Link>
            <span>/</span>
            <span className="text-gray-900">{mission.title}</span>
          </nav>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="secondary">
                  {missionTypeIcons[mission.type]} {missionTypeLabels[mission.type]}
                </Badge>
                <Badge variant={statusVariants[mission.status]}>
                  {mission.status.replace(/_/g, ' ')}
                </Badge>
                {mission.expiresAt && new Date(mission.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000 && (
                  <Badge variant="destructive">Expires Soon</Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{mission.title}</h1>
              <p className="text-gray-600 mt-2">{mission.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {isAvailable && (
                <Button size="lg" onClick={() => setShowClaimModal(true)}>
                  Claim Mission
                </Button>
              )}
              {isClaimed && (
                <Button size="lg" variant="outline" disabled>
                  Already Claimed
                </Button>
              )}
              {isCompleted && (
                <Button size="lg" variant="outline" disabled>
                  Completed
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Map */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <SimpleMap
                    center={{ lat: mission.location.lat, lng: mission.location.lng }}
                    height="300px"
                  />
                  {mission.location.address && (
                    <p className="mt-3 text-sm text-gray-600 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {mission.location.address}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Tags */}
              {mission.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {mission.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Impact Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mission Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Impact Points</span>
                    <span className="font-semibold text-lg">{mission.impactPoints}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Created</span>
                    <span className="text-gray-900">
                      {new Date(mission.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {mission.expiresAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Expires</span>
                      <span className="text-gray-900">
                        {new Date(mission.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {mission.claimedBy && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Claimed By</span>
                      <span className="text-gray-900">{mission.claimedBy}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Evidence (if submitted) */}
              {mission.evidence && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Evidence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={mission.evidence.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>
                      {mission.evidence.verificationStatus}
                    </Badge>
                    {mission.evidence.aiConfidence && (
                      <p className="mt-2 text-sm text-gray-600">
                        AI Confidence: {(mission.evidence.aiConfidence * 100).toFixed(1)}%
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Claim Modal */}
        <Modal
          isOpen={showClaimModal}
          onClose={() => setShowClaimModal(false)}
          title="Claim Mission"
          description="Are you sure you want to claim this mission?"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowClaimModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleClaim} isLoading={isClaiming}>
                Claim Mission
              </Button>
            </>
          }
        >
          <p className="text-gray-600">
            Once claimed, you&apos;ll have until{' '}
            {mission.expiresAt
              ? new Date(mission.expiresAt).toLocaleDateString()
              : 'the expiration date'}{' '}
            to complete this mission and submit evidence.
          </p>
        </Modal>
      </Container>
    </Layout>
  );
}
