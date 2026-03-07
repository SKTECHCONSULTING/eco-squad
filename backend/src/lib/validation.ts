import { z } from 'zod';

// Mission Types
const MissionTypeEnum = z.enum([
  'LITTER_COLLECTION',
  'TREE_PLANTING',
  'BIO_DIVERSITY',
  'WATER_QUALITY',
  'RECYCLING',
  'RESTORATION',
]);

const MissionStatusEnum = z.enum([
  'AVAILABLE',
  'CLAIMED',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'COMPLETED',
  'EXPIRED',
]);

// Location Schema
export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().optional(),
});

// Evidence Schema
export const EvidenceSchema = z.object({
  imageS3Key: z.string().min(1, 'Image S3 key is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Create Mission Schema
export const CreateMissionSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  type: MissionTypeEnum,
  location: LocationSchema,
  impactPoints: z.number().int().min(1).max(10000),
  expiresAt: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
});

// Update Mission Schema
export const UpdateMissionSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(2000).optional(),
  type: MissionTypeEnum.optional(),
  location: LocationSchema.optional(),
  impactPoints: z.number().int().min(1).max(10000).optional(),
  status: MissionStatusEnum.optional(),
  expiresAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

// Claim Mission Schema
export const ClaimMissionSchema = z.object({
  squadId: z.string().uuid('Invalid squad ID format'),
});

// Submit Evidence Schema
export const SubmitEvidenceSchema = z.object({
  imageS3Key: z.string().min(1, 'Image S3 key is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Squad Schemas
export const CreateSquadSchema = z.object({
  name: z.string().min(2).max(50),
  memberIds: z.array(z.string().uuid()).min(1).max(20).optional(),
});

export const UpdateSquadSchema = z.object({
  name: z.string().min(2).max(50).optional(),
});

export const AddMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  role: z.enum(['LEADER', 'MEMBER']).default('MEMBER'),
});

// Discover Missions Query Schema
export const DiscoverMissionsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(50000),
}).transform((data) => ({
  ...data,
  radius: data.radius ?? 5000,
}));

// UUID Param Schema
export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// Auth Schemas
export const SignupSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

// Types inferred from schemas
export type CreateMissionInput = z.infer<typeof CreateMissionSchema>;
export type UpdateMissionInput = z.infer<typeof UpdateMissionSchema>;
export type ClaimMissionInput = z.infer<typeof ClaimMissionSchema>;
export type SubmitEvidenceInput = z.infer<typeof SubmitEvidenceSchema>;
export type CreateSquadInput = z.infer<typeof CreateSquadSchema>;
export type UpdateSquadInput = z.infer<typeof UpdateSquadSchema>;
export type AddMemberInput = z.infer<typeof AddMemberSchema>;
export type DiscoverMissionsQuery = z.infer<typeof DiscoverMissionsQuerySchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
