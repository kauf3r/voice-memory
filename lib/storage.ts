import { supabase } from './supabase'

const AUDIO_BUCKET = 'audio-files'

export async function uploadAudioFile(
  file: File,
  userId: string
): Promise<{ url: string | null; error: Error | null }> {
  try {
    // Create unique filename
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL (with signed URL for privacy)
    const { data } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(filePath)

    return { url: data.publicUrl, error: null }
  } catch (error) {
    return { url: null, error: error as Error }
  }
}

export async function getSignedAudioUrl(
  filePath: string
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (error) throw error

    return { url: data.signedUrl, error: null }
  } catch (error) {
    return { url: null, error: error as Error }
  }
}

export async function deleteAudioFile(
  filePath: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .remove([filePath])

    if (error) throw error

    return { error: null }
  } catch (error) {
    return { error: error as Error }
  }
}

export function getAudioFilePath(audioUrl: string): string {
  // Extract file path from Supabase storage URL
  const url = new URL(audioUrl)
  const pathParts = url.pathname.split('/')
  const bucketIndex = pathParts.indexOf(AUDIO_BUCKET)
  if (bucketIndex === -1) return ''
  
  return pathParts.slice(bucketIndex + 1).join('/')
}