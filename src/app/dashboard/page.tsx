import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard | EcoSquad',
  description: 'Organization dashboard for tracking environmental impact',
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Organization Dashboard</h1>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Impact Points</p>
            <p className="text-3xl font-bold text-primary-600 mt-2">--</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Missions Completed</p>
            <p className="text-3xl font-bold text-primary-600 mt-2">--</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Active Squads</p>
            <p className="text-3xl font-bold text-primary-600 mt-2">--</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">CO₂ Offset (kg)</p>
            <p className="text-3xl font-bold text-primary-600 mt-2">--</p>
          </div>
        </div>

        {/* Placeholder for charts and data */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <p className="text-gray-500">Dashboard data will be loaded here...</p>
        </div>
      </div>
    </div>
  )
}
