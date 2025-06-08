import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface Expense {
  id: string
  amount: number
  description: string
  vendor: string
  date: string
  category_id: string | null
  categories?: { name: string; color: string }
}

interface EditExpenseDialogProps {
  expense: Expense | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EditExpenseDialog: React.FC<EditExpenseDialogProps> = ({
  expense,
  open,
  onOpenChange
}) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    vendor: '',
    description: '',
    date: new Date(),
    category_id: ''
  })
  const queryClient = useQueryClient()

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) throw error
      return data || []
    }
  })

  // Update form data when expense changes
  useEffect(() => {
    if (expense) {
      setFormData({
        amount: expense.amount.toString(),
        vendor: expense.vendor,
        description: expense.description,
        date: new Date(expense.date),
        category_id: expense.category_id || 'none'
      })
    }
  }, [expense])

  const handleInputChange = (field: string, value: string | Date) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expense) return

    setLoading(true)
    try {
      const updateData = {
        amount: parseFloat(formData.amount),
        vendor: formData.vendor.trim(),
        description: formData.description.trim(),
        date: formData.date.toISOString().split('T')[0],
        category_id: formData.category_id === 'none' ? null : formData.category_id || null,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', expense.id)

      if (error) throw error

      // Refresh the expenses list
      queryClient.invalidateQueries({ queryKey: ['expenses-list'] })

      toast({
        title: "Expense updated",
        description: "The expense has been successfully updated."
      })

      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update expense",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = () => {
    return (
      formData.amount &&
      parseFloat(formData.amount) > 0 &&
      formData.vendor.trim() &&
      formData.description.trim()
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className="pl-8"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor *</Label>
            <Input
              id="vendor"
              placeholder="Enter vendor name"
              value={formData.vendor}
              onChange={(e) => handleInputChange('vendor', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Enter expense description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(formData.date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => date && handleInputChange('date', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => handleInputChange('category_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid() || loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditExpenseDialog
