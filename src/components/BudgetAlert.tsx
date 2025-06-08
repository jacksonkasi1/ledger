import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Edit, Trash2 } from 'lucide-react'

// Separate component for delete confirmation dialog
interface DeleteAlertDialogProps {
  alert: any
  onDelete: (alertId: string) => void
  isDeleting: boolean
}

function DeleteAlertDialog({ alert, onDelete, isDeleting }: DeleteAlertDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDeleting}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Budget Alert</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this budget alert for ${alert.amount_limit} monthly limit? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(alert.id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function BudgetAlert() {
  const [newAlert, setNewAlert] = useState({
    amount_limit: '',
    period: 'monthly',
    category_id: 'all',
    is_active: true
  })

  const [editingAlert, setEditingAlert] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const queryClient = useQueryClient()

  // Fetch existing budget alerts
  const { data: budgetAlerts = [], isLoading: alertsLoading, error: alertsError } = useQuery({
    queryKey: ['budget-alerts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('budget_alerts')
        .select(`
          *,
          categories(name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    retry: 3,
    retryDelay: 1000
  })

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) throw error
      return data || []
    },
    retry: 3,
    retryDelay: 1000
  })

  // Create budget alert mutation
  const createAlertMutation = useMutation({
    mutationFn: async (alertData: typeof newAlert) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('budget_alerts')
        .insert({
          ...alertData,
          amount_limit: parseFloat(alertData.amount_limit),
          user_id: user.id,
          category_id: alertData.category_id === 'all' ? null : alertData.category_id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-alerts'] })
      setNewAlert({
        amount_limit: '',
        period: 'monthly',
        category_id: 'all',
        is_active: true
      })
      toast({
        title: "Budget alert created",
        description: "You'll receive email notifications when you exceed your budget."
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error creating alert",
        description: error.message || "Failed to create budget alert. Please try again.",
        variant: "destructive"
      })
    }
  })

  // Update budget alert mutation
  const updateAlertMutation = useMutation({
    mutationFn: async (alertData: any) => {
      const { data, error } = await supabase
        .from('budget_alerts')
        .update({
          amount_limit: parseFloat(alertData.amount_limit),
          period: alertData.period,
          category_id: alertData.category_id === 'all' ? null : alertData.category_id,
          is_active: alertData.is_active
        })
        .eq('id', alertData.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-alerts'] })
      setEditDialogOpen(false)
      setEditingAlert(null)
      toast({
        title: "Budget alert updated",
        description: "Your budget alert has been successfully updated."
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error updating alert",
        description: error.message || "Failed to update budget alert. Please try again.",
        variant: "destructive"
      })
    }
  })

  // Delete budget alert mutation
  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('budget_alerts')
        .delete()
        .eq('id', alertId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-alerts'] })
      toast({
        title: "Budget alert deleted",
        description: "Your budget alert has been successfully deleted."
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting alert",
        description: error.message || "Failed to delete budget alert. Please try again.",
        variant: "destructive"
      })
    }
  })

  const handleCreateAlert = () => {
    if (!newAlert.amount_limit || parseFloat(newAlert.amount_limit) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid budget limit amount greater than 0.",
        variant: "destructive"
      })
      return
    }

    createAlertMutation.mutate(newAlert)
  }

  const handleEditAlert = (alert: any) => {
    setEditingAlert({
      ...alert,
      amount_limit: alert.amount_limit.toString(),
      category_id: alert.category_id || 'all'
    })
    setEditDialogOpen(true)
  }

  const handleUpdateAlert = () => {
    if (!editingAlert.amount_limit || parseFloat(editingAlert.amount_limit) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid budget limit amount greater than 0.",
        variant: "destructive"
      })
      return
    }

    updateAlertMutation.mutate(editingAlert)
  }

  const handleDeleteAlert = (alertId: string) => {
    deleteAlertMutation.mutate(alertId)
  }

  // Handle loading and error states
  if (alertsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Budget Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-destructive">Failed to load budget alerts. Please refresh the page.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Budget Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount_limit">Monthly Limit ($)</Label>
              <Input
                id="amount_limit"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="1000.00"
                value={newAlert.amount_limit}
                onChange={(e) => setNewAlert(prev => ({ ...prev, amount_limit: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="category">Category (Optional)</Label>
              <Select 
                value={newAlert.category_id} 
                onValueChange={(value) => setNewAlert(prev => ({ ...prev, category_id: value }))}
                disabled={categoriesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Enable Alerts</Label>
            <Switch 
              checked={newAlert.is_active} 
              onCheckedChange={(checked) => setNewAlert(prev => ({ ...prev, is_active: checked }))}
            />
          </div>

          <Button 
            onClick={handleCreateAlert} 
            disabled={createAlertMutation.isPending || categoriesLoading}
          >
            {createAlertMutation.isPending ? 'Creating...' : 'Create Alert'}
          </Button>
        </div>

        {alertsLoading ? (
          <div className="space-y-2">
            <h4 className="font-medium">Active Alerts</h4>
            <div className="animate-pulse space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        ) : budgetAlerts.length > 0 ? (
          <div className="space-y-2">
            <h4 className="font-medium">Active Alerts</h4>
            {budgetAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">${alert.amount_limit} monthly limit</p>
                  <p className="text-sm text-muted-foreground">
                    {alert.categories?.name || 'All categories'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted-foreground mr-2">
                    {alert.is_active ? 'Active' : 'Inactive'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditAlert(alert)}
                    disabled={updateAlertMutation.isPending}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <DeleteAlertDialog
                    alert={alert}
                    onDelete={handleDeleteAlert}
                    isDeleting={deleteAlertMutation.isPending}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <h4 className="font-medium">Active Alerts</h4>
            <p className="text-sm text-muted-foreground">No budget alerts configured yet.</p>
          </div>
        )}

        {/* Edit Alert Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Budget Alert</DialogTitle>
            </DialogHeader>
            {editingAlert && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_amount_limit">Monthly Limit ($)</Label>
                    <Input
                      id="edit_amount_limit"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="1000.00"
                      value={editingAlert.amount_limit}
                      onChange={(e) => setEditingAlert(prev => ({ ...prev, amount_limit: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_category">Category (Optional)</Label>
                    <Select 
                      value={editingAlert.category_id} 
                      onValueChange={(value) => setEditingAlert(prev => ({ ...prev, category_id: value }))}
                      disabled={categoriesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Enable Alerts</Label>
                  <Switch 
                    checked={editingAlert.is_active} 
                    onCheckedChange={(checked) => setEditingAlert(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateAlert} disabled={updateAlertMutation.isPending}>
                {updateAlertMutation.isPending ? 'Updating...' : 'Update Alert'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
