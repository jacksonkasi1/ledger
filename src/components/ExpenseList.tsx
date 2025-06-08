
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { 
  Search, 
  Filter, 
  Download, 
  Plus,
  Calendar,
  DollarSign,
  MoreHorizontal,
  Edit,
  Trash2
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import EditExpenseDialog from './EditExpenseDialog'
import DeleteExpenseDialog from './DeleteExpenseDialog'

interface Expense {
  id: string
  amount: number
  description: string
  vendor: string
  date: string
  category_id: string | null
  categories?: { name: string; color: string }
}

const ExpenseList = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date-desc')
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const categories = [
    'Food & Dining',
    'Shopping', 
    'Transportation',
    'Entertainment',
    'Health & Medical',
    'Bills & Utilities',
    'Travel',
    'Business',
    'Education',
    'Other'
  ]

  const categoryColors = {
    'Food & Dining': 'bg-orange-500',
    'Shopping': 'bg-purple-500',
    'Transportation': 'bg-blue-500',
    'Entertainment': 'bg-pink-500',
    'Health & Medical': 'bg-red-500',
    'Bills & Utilities': 'bg-yellow-500',
    'Travel': 'bg-green-500',
    'Business': 'bg-indigo-500',
    'Education': 'bg-teal-500',
    'Other': 'bg-gray-500'
  }

  // Fetch expenses with categories
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          categories(name, color)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  // Filter and sort expenses
  const filteredExpenses = React.useMemo(() => {
    let filtered = expenses

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(expense => 
        expense.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(expense => expense.categories?.name === categoryFilter)
    }

    // Sort expenses
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case 'amount-desc':
          return Number(b.amount) - Number(a.amount)
        case 'amount-asc':
          return Number(a.amount) - Number(b.amount)
        case 'vendor':
          return a.vendor.localeCompare(b.vendor)
        default:
          return 0
      }
    })

    return filtered
  }, [expenses, searchTerm, categoryFilter, sortBy])

  const exportExpenses = async () => {
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
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)

      toast({
        title: "Export successful",
        description: "Expenses exported to CSV file"
      })
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive"
      })
    }
  }

  const handleEditExpense = (expense: Expense) => {
    setEditExpense(expense)
    setEditDialogOpen(true)
  }

  const handleDeleteExpense = (expense: Expense) => {
    setDeleteExpense(expense)
    setDeleteDialogOpen(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-40 bg-muted rounded"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Expenses</h2>
          <p className="text-muted-foreground">
            Manage and track your expenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportExpenses} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Date (Newest)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Date (Newest)</SelectItem>
                <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
                <SelectItem value="vendor">Vendor (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center justify-between bg-muted rounded-lg px-3 h-10">
              <span className="text-sm font-medium">Total:</span>
              <span className="font-bold">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expense List */}
      <Card>
        <CardContent className="p-0">
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No expenses found</h3>
              <p className="text-muted-foreground">
                {searchTerm || categoryFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Start by forwarding your receipts to automatically track expenses'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="p-6 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-full ${categoryColors[expense.categories?.name as keyof typeof categoryColors] || 'bg-gray-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{expense.vendor}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {expense.categories?.name || 'Other'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {expense.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(expense.date)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold">${Number(expense.amount).toFixed(2)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditExpense(expense)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteExpense(expense)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EditExpenseDialog
        expense={editExpense}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Delete Dialog */}
      <DeleteExpenseDialog
        expense={deleteExpense}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  )
}

export default ExpenseList
