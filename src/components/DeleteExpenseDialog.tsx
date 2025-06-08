import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Loader2, Calendar, DollarSign } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

interface Expense {
  id: string
  amount: number
  description: string
  vendor: string
  date: string
  category_id: string | null
  categories?: { name: string; color: string }
}

interface DeleteExpenseDialogProps {
  expense: Expense | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DeleteExpenseDialog: React.FC<DeleteExpenseDialogProps> = ({
  expense,
  open,
  onOpenChange
}) => {
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const handleDelete = async () => {
    if (!expense) return

    setLoading(true)
    try {
      // First delete any related attachments
      const { error: attachmentError } = await supabase
        .from('expense_attachments')
        .delete()
        .eq('expense_id', expense.id)

      if (attachmentError) {
        console.warn('Error deleting attachments:', attachmentError)
        // Continue with expense deletion even if attachment deletion fails
      }

      // Delete the expense
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)

      if (error) throw error

      // Refresh the expenses list
      queryClient.invalidateQueries({ queryKey: ['expenses-list'] })

      toast({
        title: "Expense deleted",
        description: "The expense has been permanently deleted."
      })

      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete expense",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (!expense) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Expense
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Message */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">
              Are you sure you want to delete this expense?
            </p>
            <p className="text-xs text-destructive/80 mt-1">
              This action cannot be undone. The expense and all associated data will be permanently removed.
            </p>
          </div>

          {/* Expense Details */}
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Expense Details
            </h4>
            
            <div className="space-y-2">
              {/* Amount and Vendor */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-lg">
                    ${Number(expense.amount).toFixed(2)}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {expense.categories?.name || 'No Category'}
                </Badge>
              </div>

              {/* Vendor */}
              <div>
                <p className="font-medium">{expense.vendor}</p>
                <p className="text-sm text-muted-foreground">
                  {expense.description}
                </p>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDate(expense.date)}
              </div>
            </div>
          </div>

          {/* Additional Warning */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              This will also delete any receipt attachments associated with this expense.
            </p>
          </div>
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
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteExpenseDialog
