'use client';

import * as React from 'react';
import Link from 'next/link';
import { Mission, Squad } from '@/types';
import { Layout, Container } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DashboardStatsSkeleton, ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const createMissionSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  type: z.string().min(1, 'Please select a type'),
  impactPoints: z.number().min(1).max(10000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

type CreateMissionForm = z.infer<typeof createMissionSchema>;

const missionTypes = [
  { value: 'LITTER_COLLECTION', label: '🗑️ Litter Collection' },
  { value: 'TREE_PLANTING', label: '🌳 Tree Planting' },
  { value: 'BIO_DIVERSITY', label: '🦋 Biodiversity' },
  { value: 'WATER_QUALITY', label: '💧 Water Quality' },
  { value: 'RECYCLING', label: '♻️ Recycling' },
  { value: 'RESTORATION', label: '🌱 Restoration' },
];

const COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function DashboardPage() {
  const [stats, setStats] = React.useState({
    totalImpactPoints: 0,
    missionsCompleted: 0,
    activeSquads: 0,
    co2Offset: 0,
  });
  const [recentMissions, setRecentMissions] = React.useState<Mission[]>([]);
  const [squads, setSquads] = React.useState<Squad[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateMissionForm>({
    resolver: zodResolver(createMissionSchema),
    defaultValues: {
      impactPoints: 100,
      lat: 37.7749,
      lng: -122.4194,
    },
  });

  React.useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch stats
        const missionsRes = await fetch('/api/missions?lat=37.7749&lng=-122.4194&radius=50000');
        const squadsRes = await fetch('/api/squads');

        const missionsData = await missionsRes.json();
        const squadsData = await squadsRes.json();

        const missions: Mission[] = missionsData.missions || [];
        const squadsList: Squad[] = squadsData.squads || [];

        // Calculate stats
        const completedMissions = missions.filter(m => m.status === 'COMPLETED');
        const totalPoints = completedMissions.reduce((sum, m) => sum + m.impactPoints, 0);
        const activeSquads = squadsList.length;
        const co2Offset = totalPoints * 0.5; // Rough estimate

        setStats({
          totalImpactPoints: totalPoints,
          missionsCompleted: completedMissions.length,
          activeSquads,
          co2Offset: Math.round(co2Offset),
        });

        setRecentMissions(missions.slice(0, 5));
        setSquads(squadsList.slice(0, 3));
      } catch (error) {
        toast.error('Failed to load dashboard data');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const onCreateMission = async (data: CreateMissionForm) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          location: { lat: data.lat, lng: data.lng },
          tags: [],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create mission');
      }

      toast.success('Mission created successfully!');
      setShowCreateModal(false);
      reset();
      
      // Refresh data
      const missionsRes = await fetch('/api/missions?lat=37.7749&lng=-122.4194&radius=50000');
      const missionsData = await missionsRes.json();
      setRecentMissions(missionsData.missions?.slice(0, 5) || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create mission');
    } finally {
      setIsCreating(false);
    }
  };

  // Sample data for charts
  const monthlyData = [
    { month: 'Jan', missions: 12, points: 450 },
    { month: 'Feb', missions: 18, points: 680 },
    { month: 'Mar', missions: 25, points: 920 },
    { month: 'Apr', missions: 22, points: 850 },
    { month: 'May', missions: 30, points: 1200 },
    { month: 'Jun', missions: 35, points: 1450 },
  ];

  const missionTypeData = [
    { name: 'Litter', value: 35 },
    { name: 'Tree', value: 25 },
    { name: 'Water', value: 20 },
    { name: 'Recycling', value: 15 },
    { name: 'Other', value: 5 },
  ];

  return (
    <Layout>
      <Container className="py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Track your environmental impact and manage missions
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Mission
          </Button>
        </div>

        {isLoading ? (
          <DashboardStatsSkeleton />
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Impact Points</p>
                      <p className="text-3xl font-bold text-primary-600 mt-2">
                        {stats.totalImpactPoints.toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Missions Completed</p>
                      <p className="text-3xl font-bold text-primary-600 mt-2">
                        {stats.missionsCompleted}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Squads</p>
                      <p className="text-3xl font-bold text-primary-600 mt-2">
                        {stats.activeSquads}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">CO₂ Offset (kg)</p>
                      <p className="text-3xl font-bold text-primary-600 mt-2">
                        {stats.co2Offset.toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Activity</CardTitle>
                  <CardDescription>Missions completed and impact points over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="missions" fill="#16a34a" name="Missions" />
                      <Bar dataKey="points" fill="#3b82f6" name="Points" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mission Types</CardTitle>
                  <CardDescription>Distribution of mission types completed</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={missionTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {missionTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                    {missionTypeData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-1 text-sm">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-gray-600">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Missions</CardTitle>
                    <CardDescription>Latest missions in your area</CardDescription>
                  </div>
                  <Link href="/missions">
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {recentMissions.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No recent missions</p>
                  ) : (
                    <div className="space-y-3">
                      {recentMissions.map((mission) => (
                        <div
                          key={mission.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{mission.title}</p>
                            <p className="text-sm text-gray-500">
                              {mission.type.replace(/_/g, ' ')} • {mission.impactPoints} points
                            </p>
                          </div>
                          <Badge variant={mission.status === 'AVAILABLE' ? 'success' : 'warning'}>
                            {mission.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Squad Management */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Your Squads</CardTitle>
                    <CardDescription>Manage your environmental squads</CardDescription>
                  </div>
                  <Link href="/squads">
                    <Button variant="outline" size="sm">Manage</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {squads.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">You haven&apos;t joined any squads yet</p>
                      <Link href="/squads">
                        <Button size="sm">Find Squads</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {squads.map((squad) => (
                        <div
                          key={squad.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{squad.name}</p>
                            <p className="text-sm text-gray-500">
                              {squad.members.length} members • {squad.totalImpactPoints} points
                            </p>
                          </div>
                          <Link href={`/squads/${squad.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Create Mission Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Mission"
          description="Create a new environmental mission for volunteers"
          size="lg"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit(onCreateMission)} isLoading={isCreating}>
                Create Mission
              </Button>
            </>
          }
        >
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mission Title
                </label>
                <Input
                  placeholder="e.g., Clean Up Central Park"
                  error={errors.title?.message}
                  {...register('title')}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Textarea
                  placeholder="Describe the mission and what volunteers should do..."
                  rows={3}
                  error={errors.description?.message}
                  {...register('description')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mission Type
                </label>
                <Select options={missionTypes} error={errors.type?.message} {...register('type')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Impact Points
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  error={errors.impactPoints?.message}
                  {...register('impactPoints', { valueAsNumber: true })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latitude
                </label>
                <Input
                  type="number"
                  step="any"
                  error={errors.lat?.message}
                  {...register('lat', { valueAsNumber: true })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitude
                </label>
                <Input
                  type="number"
                  step="any"
                  error={errors.lng?.message}
                  {...register('lng', { valueAsNumber: true })}
                />
              </div>
            </div>
          </form>
        </Modal>
      </Container>
    </Layout>
  );
}
