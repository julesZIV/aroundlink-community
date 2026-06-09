'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import dynamic from 'next/dynamic'

const InstitutionsView = dynamic(() => import('@/components/network/InstitutionsView'), { ssr: false })

function NetworkContent() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''

  return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 56px)' }}>
        <InstitutionsView externalSearch={q} />
      </div>
    </AppShell>
  )
}

export default function NetworkPage() {
  return (
    <Suspense>
      <NetworkContent />
    </Suspense>
  )
}
