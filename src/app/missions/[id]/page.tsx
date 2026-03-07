// Required for static export with dynamic routes
export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

export default function MissionDetailPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Mission Detail</h1>
      <p>This page will be rendered client-side.</p>
    </div>
  );
}
