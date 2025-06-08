
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'

interface Expense {
  id: string
  amount: number
  description: string
  vendor: string
  date: string
  category_id: string | null
  categories?: { name: string; color: string }
}

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('30')

  const categoryColors = {
    'Food & Dining': '#f59e0b',
    'Shopping': '#8b5cf6',
    'Transportation': '#3b82f6',
    'Entertainment': '#ec4899',
    'Health & Medical': '#ef4444',
    'Bills & Utilities': '#eab308',
    'Travel': '#10b981',
    'Business': '#6366f1',
    'Education': '#14b8a6',
    'Other': '#6b7280'
  }

  // Fetch expenses with categories
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['analytics-expenses', timeRange],
    queryFn: async () => {
      const daysAgo = parseInt(timeRange)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysAgo)

      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          categories(name, color)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  const getCategoryData = () => {
    const categoryTotals = expenses.reduce((acc, expense) => {
      const categoryName = expense.categories?.name || 'Other'
      acc[categoryName] = (acc[categoryName] || 0) + Number(expense.amount)
      return acc
    }, {} as Record<string, number>)

    return Object.entries(categoryTotals).map(([category, amount]) => ({
      name: category,
      value: amount,
      color: categoryColors[category as keyof typeof categoryColors] || '#6b7280'
    }))
  }

  const getMonthlyData = () => {
    const monthlyTotals = expenses.reduce((acc, expense) => {
      const month = new Date(expense.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      acc[month] = (acc[month] || 0) + Number(expense.amount)
      return acc
    }, {} as Record<string, number>)

    return Object.entries(monthlyTotals)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
  }

  const getDailyTrend = () => {
    const dailyTotals = expenses.reduce((acc, expense) => {
      const day = expense.date
      acc[day] = (acc[day] || 0) + Number(expense.amount)
      return acc
    }, {} as Record<string, number>)

    return Object.entries(dailyTotals)
      .map(([date, amount]) => ({ 
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        amount 
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14) // Last 14 days
  }

  const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const avgDaily = expenses.length > 0 ? totalSpent / parseInt(timeRange) : 0
  const mostExpensiveCategory = getCategoryData().sort((a, b) => b.value - a.value)[0]

  const stats = [
    {
      title: "Total Spent",
      value: `$${totalSpent.toFixed(2)}`,
      subtitle: `Last ${timeRange} days`
    },
    {
      title: "Daily Average",
      value: `$${avgDaily.toFixed(2)}`,
      subtitle: "Per day"
    },
    {
      title: "Most Spent",
      value: mostExpensiveCategory?.name || 'N/A',
      subtitle: `$${mostExpensiveCategory?.value?.toFixed(2) || '0.00'}`
    },
    {
      title: "Total Transactions",
      value: expenses.length.toString(),
      subtitle: "Processed receipts"
    }
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-muted-foreground">
            Insights into your spending patterns
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">
                  {stat.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.subtitle}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getCategoryData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {getCategoryData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {getCategoryData().slice(0, 6).map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getDailyTrend()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getMonthlyData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Analytics
