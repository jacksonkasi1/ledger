
import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Receipt, 
  PieChart, 
  Settings, 
  Menu, 
  X,
  LogOut,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ThemeToggle } from './ThemeToggle'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'

interface LayoutProps {
  children: React.ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
}

const Layout = ({ children, activeTab, onTabChange }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fetch user profile
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    }
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'expenses', name: 'Expenses', icon: Receipt },
    { id: 'analytics', name: 'Analytics', icon: PieChart },
    { id: 'settings', name: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform bg-card text-card-foreground transition-transform duration-300 lg:static lg:translate-x-0 border-r",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-primary-foreground text-sm">
                L
              </div>
              <span className="text-xl font-bold">LEDGR</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id)
                    setSidebarOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </button>
              )
            })}
          </nav>

          <div className="border-t p-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between bg-card border-b px-4 lg:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold capitalize">
              {activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Avatar className="h-8 w-8">
              <AvatarImage src={userProfile?.avatar_url || undefined} />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
