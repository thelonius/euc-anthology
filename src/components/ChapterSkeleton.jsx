import { h } from 'preact'

// Shown by Suspense while a lazy chapter chunk is loading.
// Mimics the rough shape of ChapterLayout to avoid layout jumps.
export function ChapterSkeleton() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 48px 100px' }}>
      <div style={{ width: '120px', height: '10px', background: '#1a1a1a', borderRadius: '2px', marginBottom: '20px' }} />
      <div style={{ width: '60%', height: '40px', background: '#161616', borderRadius: '4px', marginBottom: '12px' }} />
      <div style={{ width: '40%', height: '18px', background: '#141414', borderRadius: '4px', marginBottom: '48px' }} />
      <div style={{ width: '100%', height: '14px', background: '#121212', borderRadius: '4px', marginBottom: '12px' }} />
      <div style={{ width: '95%', height: '14px', background: '#121212', borderRadius: '4px', marginBottom: '12px' }} />
      <div style={{ width: '88%', height: '14px', background: '#121212', borderRadius: '4px', marginBottom: '12px' }} />
    </div>
  )
}
