'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { University } from '@/lib/supabase/supabase/types'

export default function MapView() {
  const router  = useRouter()
  const supabase = createClient()
  const mapRef  = useRef<any>(null)
  const divRef  = useRef<HTMLDivElement>(null)
  const [unis,  setUnis]  = useState<University[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  // Charger toutes les universités avec coordonnées depuis Supabase
  useEffect(() => {
    supabase
      .from('universities')
      .select('id, display_name, country_name, country_code, city, lat, lng, erasmus_code, is_erasmus, flag')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('display_name')
      .then(({ data, error: err }) => {
        if (err) { setError(true); return }
        setUnis((data ?? []) as unknown as University[])
        setReady(true)
      })
  }, [])

  useEffect(() => {
    if (!ready || !divRef.current || mapRef.current) return

    import('leaflet').then(L => {
      ;(L.Icon.Default as unknown as { mergeOptions(o: object): void }).mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(divRef.current!, { center: [48, 10], zoom: 4, zoomControl: true })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map)

      // Grouper par pays (lat/lng réels depuis la DB)
      const clusters: Record<string, { unis: University[]; lat: number; lng: number }> = {}

      unis.forEach(u => {
        if (!u.lat || !u.lng || !u.country_name) return
        const key = u.country_name
        if (!clusters[key]) {
          // Centroïde approximatif : moyenne des coords du pays
          clusters[key] = { unis: [], lat: u.lat, lng: u.lng }
        }
        clusters[key].unis.push(u)
        // Affiner le centroïde par moyenne
        const n = clusters[key].unis.length
        clusters[key].lat = (clusters[key].lat * (n - 1) + u.lat) / n
        clusters[key].lng = (clusters[key].lng * (n - 1) + u.lng) / n
      })

      const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

      Object.entries(clusters).forEach(([country, { unis: cUnis, lat, lng }]) => {
        const count = cUnis.length
        const hasErasmus = cUnis.some(u => u.is_erasmus)
        const color = hasErasmus ? '#1a3055' : '#64748b'
        const size = Math.min(12 + Math.sqrt(count) * 1.5, 40)

        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:${size < 20 ? 8 : 10}px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">${count}</div>`,
          iconSize: [size, size],
          iconAnchor: [size/2, size/2],
        })

        const marker = L.marker([lat, lng], { icon }).addTo(map)

        const sample = cUnis.slice(0, 5)
        const listHtml = sample.map(u =>
          `<div style="padding:4px 0;border-bottom:1px solid #f1f5f9;cursor:pointer" onclick="window.__al_nav(${u.id})">
            <div style="font-weight:700;font-size:12px;color:#1a3055">${esc(u.display_name)}</div>
            ${u.erasmus_code ? `<div style="font-size:10px;color:#64748b;font-family:monospace">${esc(u.erasmus_code)}</div>` : ''}
          </div>`
        ).join('')

        const moreHtml = count > 5
          ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px;text-align:center">+${count - 5} more</div>`
          : ''

        marker.bindPopup(`
          <div style="min-width:200px">
            <div style="font-weight:800;font-size:13px;color:#1a3055;margin-bottom:6px">
              ${esc(country)} · ${count} ${count === 1 ? 'university' : 'universities'}
            </div>
            ${listHtml}
            ${moreHtml}
          </div>
        `, { maxWidth: 280 })
      })

      ;(window as unknown as Record<string, unknown>).__al_nav = (id: number) => router.push(`/university/${id}`)
    })

    return () => {
      delete (window as unknown as Record<string, unknown>).__al_nav
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [ready, unis, router])

  if (error) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <p className="text-sm">Failed to load map data.</p>
    </div>
  )

  if (!ready) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <p className="text-sm">Loading map…</p>
    </div>
  )

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div ref={divRef} style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 112px)' }} />
    </div>
  )
}
