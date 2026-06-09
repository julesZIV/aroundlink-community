import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-7xl font-black mb-4" style={{ color: '#e2e8f0' }}>404</p>
      <h1 className="text-xl font-bold mb-2" style={{ color: '#1a3055' }}>Page not found</h1>
      <p className="text-sm text-slate-400 mb-6 max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/feed"
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: '#1a3055' }}>
        ← Back to home
      </Link>
    </div>
  )
}
