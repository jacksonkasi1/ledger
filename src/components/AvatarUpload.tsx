
import React, { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, User } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface AvatarUploadProps {
  url?: string | null
  onUpload: (url: string) => void
}

export function AvatarUpload({ url, onUpload }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.')
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('User not authenticated')

      const fileName = `${user.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      onUpload(data.publicUrl)
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully."
      })
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20">
        <AvatarImage src={url || undefined} />
        <AvatarFallback>
          <User className="h-8 w-8" />
        </AvatarFallback>
      </Avatar>
      <div>
        <Input
          type="file"
          id="avatar"
          accept="image/*"
          onChange={uploadAvatar}
          disabled={uploading}
          className="hidden"
        />
        <Button
          asChild
          variant="outline"
          disabled={uploading}
          className="cursor-pointer"
        >
          <label htmlFor="avatar">
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Change Avatar'}
          </label>
        </Button>
      </div>
    </div>
  )
}
