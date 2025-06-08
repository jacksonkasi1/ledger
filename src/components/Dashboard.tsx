import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/calendar'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Plus, DollarSign, TrendingUp, Calendar as CalendarIcon, Download } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import * as z from 'zod'

interface Expense {
  id: string
  amount: number
  description: string
  vendor: string
  date: string
  categories?: { name: string; color: string }
}

interface Category {
  id: string
  name: string
  color: string
  icon: string
}

const expenseSchema = z.object({
  amount: z.string().min(1, 'Amount is required').refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Amount must be a positive number'),
  description: z.string().min(1, 'Description is required'),
  vendor: z.string().min(1, 'Vendor is required'),
  category_id: z.string().optional(),
  date: z.date({
    required_error: 'Date is required',
  }),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

const Dashboard = () => {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)

  const queryClient = useQueryClient()

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: '',
      description: '',
      vendor: '',
      category_id: '',
      date: new Date(),
    },
  })

  // Fetch recent expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          categories(name, color)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      return data
    }
  })

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) throw error
      return data
    }
  })

  // Calculate stats
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
      
      const { data: monthlyExpenses, error } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', currentMonth)

      if (error) throw error

      const total = monthlyExpenses?.reduce((sum, expense) => sum + parseFloat(expense.amount.toString()), 0) || 0
      const count = monthlyExpenses?.length || 0

      return {
        monthlyTotal: total,
        expenseCount: count,
        averageExpense: count > 0 ? total / count : 0
      }
    }
  })

  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: async (expenseData: ExpenseFormData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          amount: parseFloat(expenseData.amount),
          description: expenseData.description,
          vendor: expenseData.vendor,
          category_id: expenseData.category_id || null,
          date: expenseData.date.toISOString().split('T')[0],
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setIsAddExpenseOpen(false)
      form.reset({
        amount: '',
        description: '',
        vendor: '',
        category_id: '',
        date: new Date(),
      })
      toast({
        title: "Expense added!",
        description: "Your expense has been recorded successfully."
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleAddExpense = (data: ExpenseFormData) => {
    addExpenseMutation.mutate(data)
  }

  const exportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const response = await supabase.functions.invoke('export-data', {
        body: {
          user_id: user.id,
          format: 'csv'
        }
      })

      if (response.error) throw response.error

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'expenses.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export successful!",
        description: "Your expenses have been exported to CSV."
      })
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  // Add budget checking effect
  useEffect(() => {
    const checkBudgetAlerts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get active budget alerts
        const { data: alerts } = await supabase
          .from('budget_alerts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)

        if (!alerts || alerts.length === 0) return

        // Get current month expenses
        const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', user.id)
          .gte('date', currentMonth)

        const totalSpent = expenses?.reduce((sum, expense) => sum + parseFloat(expense.amount.toString()), 0) || 0

        // Check each alert
        for (const alert of alerts) {
          if (totalSpent > alert.amount_limit) {
            // Send email alert
            await supabase.functions.invoke('send-budget-alert-email', {
              body: {
                userEmail: user.email,
                spentAmount: totalSpent,
                limitAmount: alert.amount_limit,
                period: alert.period
              }
            })
          }
        }
      } catch (error) {
        console.error('Error checking budget alerts:', error)
      }
    }

    checkBudgetAlerts()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to LEDGR</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportData} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddExpense)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="What did you buy?"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Where did you buy it?"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit"
                    className="w-full"
                    disabled={addExpenseMutation.isPending}
                  >
                    {addExpenseMutation.isPending ? 'Adding...' : 'Add Expense'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.monthlyTotal?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Total expenses this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.expenseCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Expenses this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.averageExpense?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <div className="text-center py-8">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No expenses yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Add your first expense or forward a receipt to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: expense.categories?.color || '#6B7280' }}
                      />
                      <div>
                        <p className="font-medium">{expense.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {expense.vendor} • {new Date(expense.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold">
                    ${Number(expense.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
