'use client';

import * as React from 'react';
import Link from 'next/link';
import { Squad } from '@/types';
import { Layout, Container } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';

const createSquadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

type CreateSquadForm = z.infer<typeof createSquadSchema>;

export default function SquadsPage() {
  const [squads, setSquads] = React.useState<Squad[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateSquadForm>({
    resolver: zodResolver(createSquadSchema),
  });

  React.useEffect(() => {
    const fetchSquads = async () => {
      try {
        const response = await fetch('/api/squads');
        if (!response.ok) throw new Error('Failed to fetch squads');
        const data = await response.json();
        setSquads(data.squads || []);
      } catch (error) {
        toast.error('Failed to load squads');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSquads();
  }, []);

  const onCreateSquad = async (data: CreateSquadForm) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          memberIds: [], // Current user will be added as leader
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create squad');
      }

      const result = await response.json();
      toast.success('Squad created successfully!');
      setShowCreateModal(false);
      reset();
      
      // Add new squad to list
      setSquads([result.squad, ...squads]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create squad');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredSquads = squads.filter((squad) =>
    squad.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <Container className="py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Squads</h1>
            <p className="text-gray-600 mt-1">
              Join or create squads to tackle missions together
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Squad
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Search squads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Squads Grid */}
        {isLoading ? (
          <ListSkeleton count={6} />
        ) : filteredSquads.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {searchQuery ? 'No squads found' : 'No squads yet'}
            </h3>
            <p className="text-gray-500 mt-1">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Be the first to create a squad!'}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                Create Squad
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSquads.map((squad) => (
              <Card key={squad.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">🌱</span>
                    </div>
                    <Badge variant="secondary">
                      {squad.members.length} members
                    </Badge>
                  </div>
                  <CardTitle className="mt-4">{squad.name}</CardTitle>
                  <CardDescription>
                    {squad.completedMissions} missions completed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Impact</p>
                      <p className="text-xl font-semibold text-primary-600">
                        {squad.totalImpactPoints} pts
                      </p>
                    </div>
                    <Link href={`/squads/${squad.id}`}>
                      <Button variant="outline" size="sm">View Squad</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Squad Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Squad"
          description="Start a new squad and invite members to join"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit(onCreateSquad)} isLoading={isCreating}>
                Create Squad
              </Button>
            </>
          }
        >
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Squad Name
              </label>
              <Input
                placeholder="e.g., Green Warriors"
                error={errors.name?.message}
                {...register('name')}
              />
            </div>
          </form>
        </Modal>
      </Container>
    </Layout>
  );
}
