# Task: Complete Frontend UI for EcoSquad

## Overview
Build the Next.js frontend for the EcoSquad platform.

## Repository
Local path: /home/ec2-user/.openclaw/workspace/eco-squad

## What Exists
- Next.js project scaffolded
- Tailwind CSS configured
- Basic page components (home, dashboard skeleton)
- TypeScript types available

## Your Tasks
1. **Mission Discovery UI** (src/app/missions/):
   - Mission list/map view page
   - Mission detail page
   - Mission filtering and search
   - Map integration (Mapbox or Google Maps)
   - Mission cards with distance calculation

2. **Dashboard Enhancement** (src/app/dashboard/):
   - Complete dashboard with real data
   - Impact statistics components
   - Charts (use recharts or chart.js)
   - Recent activity feed
   - Squad management section
   - Mission creation form (for orgs)

3. **Authentication UI** (src/app/auth/):
   - Login page with Cognito integration
   - Signup flow
   - Password reset
   - Protected route wrapper

4. **Component Library** (src/components/):
   - Button, Card, Input, Modal components
   - Loading states and skeletons
   - Error boundaries
   - Toast notifications
   - Map component

5. **Styling**:
   - Responsive design (mobile-first)
   - Green/eco-friendly color scheme
   - Loading animations
   - Empty states

## Key Requirements
- Use Next.js App Router
- Server Components where possible
- Client Components for interactive elements
- Proper error handling
- Loading states for all async operations
- Responsive design
- Accessibility (ARIA labels, keyboard nav)

## API Integration
- Base URL: /api
- All endpoints return JSON
- Handle 401 by redirecting to login
- Use React Query or SWR for data fetching

## Deliverables
- Complete page components
- Reusable UI component library
- Responsive styling
- Error handling and loading states

Ensure the app builds with `npm run build`.