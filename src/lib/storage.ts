import { createClient } from '@/lib/supabase/client'

export const STORAGE = {
  async upload(
    bucket: 'avatars' | 'feed-media' | 'channel-media' | 'documents',
    file: File,
    path: string
  ): Promise<string> {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return publicUrl
  },

  async uploadBase64(
    bucket: 'feed-media' | 'channel-media',
    dataUrl: string,
    filename: string,
    userId: string
  ): Promise<string> {
    const [header, base64] = dataUrl.split(',')
    const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })
    const ext = filename.split('.').pop() ?? 'bin'
    const path = `${userId}/${Date.now()}.${ext}`
    return STORAGE.upload(bucket, new File([blob], filename, { type: mime }), path)
  },
}