'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mission, MissionType } from '@/types';
import { MissionCard } from '@/components/MissionCard';
import { MissionCardSkeleton } from '@/components/ui/Skeleton';
import { MissionMap } from '@/components/maps/MissionMap';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Layout, Container } from '@/components/layout/Layout';
import toast from 'react-hot-toast';

const missionTypes: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'LITTER_COLLECTION', label: '🗑️ Litter Collection' },
  { value: 'TREE_PLANTING', label: '🌳 Tree Planting' },
  { value: 'BIO_DIVERSITY', label: '🦋 Biodiversity' },
  { value: 'WATER_QUALITY', label: '💧 Water Quality' },
  { value: 'RECYCLING', label: '♻️ Recycling' },
  { value: 'RESTORATION', label: '🌱 Restoration' },
];

const radiusOptions = [
  { value: '1000', label: '1 km' },
  { value: '5000', label: '5 km' },
  { value: '10000', label: '10 km' },
  { value: '25000', label: '25 km' },
  { value: '50000', label: '50 km' },
];

export default function MissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [missions, setMissions] = React.useState<Mission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [viewMode, setViewMode] = React.useState<'list' | 'map'>('list');
  const [selectedMission, setSelectedMission] = React.useState<Mission | null>(null);
  const [isClaiming, setIsClaiming] = React.useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('q') || '');
  const [selectedType, setSelectedType] = React.useState(searchParams.get('type') || '');
  const [radius, setRadius] = React.useState(parseInt(searchParams.get('radius') || '10000'));

  // Get user location
  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Default to a central location (e.g., San Francisco)
          setUserLocation({ lat: 37.7749, lng: -122.4194 });
          toast.error('Could not get your location. Using default location.');
        }
      );
    }
  }, []);

  // Fetch missions when location changes
  React.useEffect(() => {
    if (!userLocation) return;

    const fetchMissions = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          lat: userLocation.lat.toString(),
          lng: userLocation.lng.toString(),
          radius: radius.toString(),
        });

        const response = await fetch(`/api/missions?${params}`);
        if (!response.ok) throw new Error('Failed to fetch missions');
        
        const data = await response.json();
        setMissions(data.missions);
      } catch (error) {
        toast.error('Failed to load missions');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMissions();
  }, [userLocation, radius]);

  // Update URL when filters change
  const updateFilters = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedType) params.set('type', selectedType);
    if (radius !== 10000) params.set('radius', radius.toString());
    
    router.push(`/missions?${params.toString()}`, { scroll: false });
  };

  // Filter missions
  const filteredMissions = React.useMemo(() => {
    return missions.filter((mission) => {
      const matchesSearch = !searchQuery || 
        mission.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mission.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = !selectedType || mission.type === selectedType;
      
      return matchesSearch && matchesType;
    });
  }, [missions, searchQuery, selectedType]);

  const handleClaimMission = async (missionId: string) => {
    setIsClaiming(true);
    try {
      const response = await fetch(`/api/missions/${missionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId: 'default' }), // TODO: Get actual squad
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to claim mission');
      }

      toast.success('Mission claimed successfully!');
      setSelectedMission(null);
      
      // Refresh missions
      const updatedMissions = missions.map(m => 
        m.id === missionId ? { ...m, status: 'CLAIMED' as const } : m
      );
      setMissions(updatedMissions);
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim mission');
    } finally {
      setIsClaiming(false);
    }
  };

  const mapCenter = userLocation || { lat: 37.7749, lng: -122.4194 };

  return (
    <Layout>
      <Container className="py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Discover Missions</h1>
            <p className="text-gray-600 mt-1">
              Find environmental missions near you and make a difference
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              List
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.553-.894L15 7m0 13V7" />
              </svg>
              Map
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search missions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={updateFilters}
              />
            </div>
            <div className="w-full md:w-48">
              <Select
                options={missionTypes}
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  updateFilters();
                }}
              />
            </div>
            <div className="w-full md:w-32">
              <Select
                options={radiusOptions}
                value={radius.toString()}
                onChange={(e) => {
                  setRadius(parseInt(e.target.value));
                  updateFilters();
                }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'list' ? (
          <div className="space-y-4">
            {isLoading ? (
              <>
                <MissionCardSkeleton />
                <MissionCardSkeleton />
                <MissionCardSkeleton />
              </>
            ) : filteredMissions.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">No missions found</h3>
                <p className="text-gray-500 mt-1">Try adjusting your filters or search query</p>
              </div>
            ) : (
              filteredMissions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  userLocation={userLocation || undefined}
                  onClaim={(id) => {
                    const m = missions.find(m => m.id === id);
                    if (m) setSelectedMission(m);
                  }}
                />
              ))
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <MissionMap
              center={mapCenter}
              missions={filteredMissions}
              userLocation={userLocation || undefined}
              radius={radius}
              onMissionClick={setSelectedMission}
              height="600px"
            />
          </div>
        )}

        {/* Claim Modal */}
        {selectedMission && (
          <Modal
            isOpen={!!selectedMission}
            onClose={() => setSelectedMission(null)}
            title="Claim Mission"
            description={`Do you want to claim "${selectedMission.title}"?`}
            footer={
              <>
                <Button variant="outline" onClick={() => setSelectedMission(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleClaimMission(selectedMission.id)}
                  isLoading={isClaiming}
                >
                  Claim Mission
                </Button>
              </>
            }
          >
            <div className="space-y-3">
              <p className="text-gray-600">{selectedMission.description}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {selectedMission.impactPoints} impact points
                </span>
                {selectedMission.expiresAt && (
                  <span className="flex items-center gap-1 text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Expires {new Date(selectedMission.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </Modal>
        )}
      </Container>
    </Layout>
  );
}
