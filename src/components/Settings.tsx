
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  Mail, 
  Bell, 
  User,
  Copy,
  Check
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AvatarUpload } from './AvatarUpload'
import { BudgetAlert } from './BudgetAlert'

const Settings = () => {
  const [emailForwarding, setEmailForwarding] = useState(true)
  const [budgetAlerts, setBudgetAlerts] = useState(true)
  const [weeklyReports, setWeeklyReports] = useState(false)
  const [monthlyReports, setMonthlyReports] = useState(true)
  const [copied, setCopied] = useState(false)

  const queryClient = useQueryClient()

  const forwardingEmail = "acfa104157a4c37e60578b6a01c064a8@inbound.postmarkapp.com"

  // Fetch user profile
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        // Create profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            email: user.email,
            first_name: '',
            last_name: ''
          })
          .select()
          .single()

        if (createError) throw createError
        return newProfile
      }
      return data
    }
  })

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully."
      })
    }
  })

  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: ''
  })

  React.useEffect(() => {
    if (userProfile) {
      setProfileData({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || ''
      })
    }
  }, [userProfile])

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(forwardingEmail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: "Copied",
        description: "Email address copied to clipboard"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy email address",
        variant: "destructive"
      })
    }
  }

  const handleUpdateProfile = () => {
    updateProfileMutation.mutate(profileData)
  }

  const handleAvatarUpload = (url: string) => {
    updateProfileMutation.mutate({ avatar_url: url })
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Forwarding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-base font-medium">Forward receipts to this email</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input 
                value={forwardingEmail} 
                readOnly 
                className="bg-muted"
              />
              <Button 
                onClick={handleCopyEmail}
                variant="outline" 
                size="sm"
                className="flex items-center gap-1"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Auto Process Receipts</Label>
            <Switch 
              checked={emailForwarding} 
              onCheckedChange={setEmailForwarding}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Budget Alerts</Label>
            <Switch 
              checked={budgetAlerts} 
              onCheckedChange={setBudgetAlerts}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Weekly Reports</Label>
            <Switch 
              checked={weeklyReports} 
              onCheckedChange={setWeeklyReports}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Monthly Reports</Label>
            <Switch 
              checked={monthlyReports} 
              onCheckedChange={setMonthlyReports}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarUpload 
            url={userProfile?.avatar_url}
            onUpload={handleAvatarUpload}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input 
                id="firstName" 
                value={profileData.first_name}
                onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="First name" 
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input 
                id="lastName" 
                value={profileData.last_name}
                onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Last name" 
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              value={userProfile?.email || ''} 
              readOnly 
              className="bg-muted"
            />
          </div>
          <Button onClick={handleUpdateProfile} disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending ? 'Updating...' : 'Update Profile'}
          </Button>
        </CardContent>
      </Card>

      <BudgetAlert />
    </div>
  )
}

export default Settings
