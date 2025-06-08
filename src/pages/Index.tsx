
import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Dashboard from '../components/Dashboard'
import ExpenseList from '../components/ExpenseList'
import Analytics from '../components/Analytics'
import Settings from '../components/Settings'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react'

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Parse URL fragments for auth errors and tokens
  const parseUrlFragment = () => {
    const fragment = window.location.hash.substring(1)
    const params = new URLSearchParams(fragment)
    
    const error = params.get('error')
    const errorDescription = params.get('error_description')
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')
    
    return { error, errorDescription, accessToken, refreshToken, type }
  }

  useEffect(() => {
    // Handle URL fragments on component mount
    const { error, errorDescription, accessToken, type } = parseUrlFragment()
    
    if (error) {
      let message = 'Authentication error occurred'
      if (error === 'access_denied' && errorDescription?.includes('expired')) {
        message = 'The password reset link has expired. Please request a new one.'
      } else if (errorDescription) {
        message = decodeURIComponent(errorDescription.replace(/\+/g, ' '))
      }
      
      toast({
        title: "Authentication Error",
        description: message,
        variant: "destructive"
      })
      
      // Clear the URL fragment
      window.history.replaceState(null, '', window.location.pathname)
    } else if (accessToken && type === 'recovery') {
      // Valid password reset token
      setAuthMode('reset')
      toast({
        title: "Password Reset",
        description: "Please enter your new password below."
      })
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setLoading(false)
      
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset')
        toast({
          title: "Password Reset",
          description: "Please enter your new password below."
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)

    try {
      if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`
        })
        if (error) throw error
        toast({
          title: "Password reset sent",
          description: "Check your email for a password reset link"
        })
        setAuthMode('signin')
        setEmail('')
      } else if (authMode === 'reset') {
        // Validate passwords match
        if (newPassword !== confirmPassword) {
          toast({
            title: "Password Mismatch",
            description: "Passwords do not match. Please try again.",
            variant: "destructive"
          })
          return
        }

        // Validate password strength
        if (newPassword.length < 6) {
          toast({
            title: "Weak Password",
            description: "Password must be at least 6 characters long.",
            variant: "destructive"
          })
          return
        }

        const { error } = await supabase.auth.updateUser({
          password: newPassword
        })
        
        if (error) throw error
        
        toast({
          title: "Password Updated",
          description: "Your password has been successfully updated."
        })
        
        setAuthMode('signin')
        setNewPassword('')
        setConfirmPassword('')
        
        // Clear URL fragment
        window.history.replaceState(null, '', window.location.pathname)
      } else if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        })
        if (error) throw error
        toast({
          title: "Account created",
          description: "Check your email to verify your account"
        })
        setEmail('')
        setPassword('')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast({
          title: "Welcome back"
        })
      }
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setAuthLoading(false)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'expenses':
        return <ExpenseList />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center font-bold text-primary-foreground text-xl mb-4 mx-auto animate-pulse">
            L
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center font-bold text-primary-foreground text-2xl mb-4 mx-auto">
                L
              </div>
              <h1 className="text-2xl font-bold">LEDGR</h1>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'reset' ? (
                <>
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter your new password"
                        required
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your new password"
                        required
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  
                  {authMode !== 'forgot' && (
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={authLoading}
              >
                {authLoading ? (
                  "Loading..."
                ) : authMode === 'signin' ? (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </>
                ) : authMode === 'signup' ? (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign Up
                  </>
                ) : authMode === 'reset' ? (
                  "Update Password"
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </form>

            <div className="text-center mt-4 space-y-2">
              {authMode === 'signin' && (
                <>
                  <Button
                    variant="link"
                    onClick={() => setAuthMode('forgot')}
                    className="text-sm"
                  >
                    Forgot password?
                  </Button>
                  <br />
                  <Button
                    variant="link"
                    onClick={() => setAuthMode('signup')}
                  >
                    Need an account? Sign up
                  </Button>
                </>
              )}
              
              {authMode === 'signup' && (
                <Button
                  variant="link"
                  onClick={() => setAuthMode('signin')}
                >
                  Already have an account? Sign in
                </Button>
              )}

              {authMode === 'forgot' && (
                <Button
                  variant="link"
                  onClick={() => setAuthMode('signin')}
                >
                  Back to sign in
                </Button>
              )}

              {authMode === 'reset' && (
                <Button
                  variant="link"
                  onClick={() => {
                    setAuthMode('signin')
                    setNewPassword('')
                    setConfirmPassword('')
                    window.history.replaceState(null, '', window.location.pathname)
                  }}
                >
                  Cancel password reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  )
}

export default Index
