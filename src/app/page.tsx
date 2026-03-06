import Link from 'next/link';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const features = [
  {
    icon: '🗺️',
    title: 'Discover Missions',
    description: 'Find environmental missions near you using our interactive map. From litter collection to tree planting, there\'s always something to do.',
  },
  {
    icon: '👥',
    title: 'Join Squads',
    description: 'Team up with friends, family, or community members. Squads make volunteering more fun and impactful.',
  },
  {
    icon: '🏆',
    title: 'Earn Points',
    description: 'Track your impact with our points system. Every mission completed earns you recognition and rewards.',
  },
  {
    icon: '📊',
    title: 'Measure Impact',
    description: 'See the real difference you\'re making with detailed statistics on your contributions to the environment.',
  },
];

const missionTypes = [
  { icon: '🗑️', label: 'Litter Collection', color: 'bg-green-100 text-green-700' },
  { icon: '🌳', label: 'Tree Planting', color: 'bg-emerald-100 text-emerald-700' },
  { icon: '🦋', label: 'Biodiversity', color: 'bg-blue-100 text-blue-700' },
  { icon: '💧', label: 'Water Quality', color: 'bg-cyan-100 text-cyan-700' },
  { icon: '♻️', label: 'Recycling', color: 'bg-yellow-100 text-yellow-700' },
  { icon: '🌱', label: 'Restoration', color: 'bg-purple-100 text-purple-700' },
];

export default function HomePage() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm mb-6">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">Join 10,000+ volunteers making a difference</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight">
              Make a <span className="text-primary-600">measurable impact</span> in your community
            </h1>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed">
              EcoSquad connects volunteers with micro-volunteering missions. 
              Clean up your neighborhood, plant trees, monitor wildlife, and more.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/missions">
                <Button size="lg" className="w-full sm:w-auto">
                  Find Missions
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Types */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Types of Missions</h2>
            <p className="mt-4 text-gray-600">Choose from a variety of environmental activities</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {missionTypes.map((type) => (
              <div
                key={type.label}
                className={`${type.color} rounded-xl p-6 text-center hover:shadow-md transition-shadow cursor-pointer`}
              >
                <span className="text-4xl">{type.icon}</span>
                <p className="mt-2 font-medium text-sm">{type.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-4 text-gray-600">Start making a difference in three easy steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={feature.title} className="border-0 shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">{feature.icon}</span>
                  </div>
                  <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto -mt-11 mb-4 text-sm font-bold">
                    {index + 1}
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-gray-600 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl md:text-5xl font-bold text-white">10K+</p>
              <p className="mt-2 text-primary-100">Active Volunteers</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold text-white">50K+</p>
              <p className="mt-2 text-primary-100">Missions Completed</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold text-white">100+</p>
              <p className="mt-2 text-primary-100">Cities Worldwide</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold text-white">500K+</p>
              <p className="mt-2 text-primary-100">kg CO₂ Offset</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Ready to make a difference?
          </h2>
          <p className="mt-4 text-xl text-gray-600">
            Join EcoSquad today and start your journey towards a cleaner, greener planet.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg">Get Started Free</Button>
            </Link>
            <Link href="/missions">
              <Button size="lg" variant="outline">Browse Missions</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-white">EcoSquad</span>
              </div>
              <p className="text-sm">Making environmental action accessible to everyone.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/missions" className="hover:text-white">Missions</Link></li>
                <li><Link href="/squads" className="hover:text-white">Squads</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-sm text-center">
            © {new Date().getFullYear()} EcoSquad. All rights reserved.
          </div>
        </div>
      </footer>
    </Layout>
  );
}
