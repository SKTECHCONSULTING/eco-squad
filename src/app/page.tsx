export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Welcome to <span className="text-green-600">EcoSquad</span>
        </h1>
        <p className="text-center text-lg text-gray-600 mb-8">
          Environmental Micro-Volunteering Platform
        </p>
        <div className="flex justify-center gap-4">
          <a 
            href="/missions" 
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
          >
            Find Missions
          </a>
          <a 
            href="/dashboard" 
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition"
          >
            Dashboard
          </a>
        </div>
      </div>
    </main>
  )
}
