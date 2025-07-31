'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle,
  Settings,
  TestTube,
  RefreshCw,
  Zap
} from 'lucide-react'

interface AnalysisMetrics {
  totalRequests: number
  cacheHitRate: number
  gpt4Requests: number
  gpt35Requests: number
  totalCost: number
  averageCostPerRequest: number
  averageConfidence: number
  errorRate: number
  cacheSize: number
}

interface ProcessingMetrics {
  totalProcessed: number
  totalSuccessful: number
  totalFailed: number
  successRate: number
  averageProcessingTime: number
  currentlyProcessing: number
  errorCategoryBreakdown: Record<string, number>
  uptime: number
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
  currentlyProcessing: number
  stuckNotes: number
}

interface DashboardData {
  analysis: AnalysisMetrics
  processing: ProcessingMetrics
  circuitBreaker: {
    isOpen: boolean
    failures: number
    errorTypes: Record<string, number>
  }
  systemHealth: SystemHealth
  database: {
    totalNotes: number
    processedNotes: number
    notesWithAnalysis: number
    completionRate: number
    analysisRate: number
    avgConfidence: number
    errorRate: number
  }
  recommendations: string[]
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1']

export default function AnalysisDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [runningTests, setRunningTests] = useState(false)

  useEffect(() => {
    fetchMetrics()
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchMetrics = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/analysis/metrics')
      
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      
      const metricsData = await response.json()
      setData(metricsData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const runAnalysisTests = async () => {
    try {
      setRunningTests(true)
      const response = await fetch('/api/analysis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCases: ['all'],
          analysisType: 'enhanced',
          includePromptAnalysis: true,
          validateResults: true
        })
      })
      
      if (!response.ok) {
        throw new Error('Test run failed')
      }
      
      const results = await response.json()
      setTestResults(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test run failed')
    } finally {
      setRunningTests(false)
    }
  }

  const resetMetrics = async () => {
    try {
      const response = await fetch('/api/analysis/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      })
      
      if (response.ok) {
        await fetchMetrics()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset metrics')
    }
  }

  if (loading) {
    return (
      <div className=\"flex items-center justify-center p-8\">
        <div className=\"flex items-center gap-2\">
          <RefreshCw className=\"w-4 h-4 animate-spin\" />
          <span>Loading analysis metrics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className=\"m-4\">
        <AlertTriangle className=\"h-4 w-4\" />
        <AlertDescription>
          Error loading dashboard: {error}
          <Button 
            variant=\"outline\" 
            size=\"sm\" 
            onClick={fetchMetrics}
            className=\"ml-2\"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'unhealthy': return 'text-orange-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const modelDistributionData = [
    { name: 'GPT-4', value: data.analysis.gpt4Requests, color: '#8884d8' },
    { name: 'GPT-3.5', value: data.analysis.gpt35Requests, color: '#82ca9d' }
  ]

  const errorCategoryData = Object.entries(data.processing.errorCategoryBreakdown).map(([category, count]) => ({
    category: category.replace('_', ' ').toUpperCase(),
    count
  }))

  return (
    <div className=\"p-6 space-y-6\">
      {/* Header */}
      <div className=\"flex items-center justify-between\">
        <div>
          <h1 className=\"text-3xl font-bold\">Analysis Dashboard</h1>
          <p className=\"text-muted-foreground\">
            Monitor AI analysis performance, costs, and system health
          </p>
        </div>
        
        <div className=\"flex items-center gap-2\">
          <Badge 
            variant={data.systemHealth.status === 'healthy' ? 'default' : 'destructive'}
            className={getStatusColor(data.systemHealth.status)}
          >
            <Activity className=\"w-3 h-3 mr-1\" />
            {data.systemHealth.status.toUpperCase()}
          </Badge>
          
          <Button 
            variant=\"outline\" 
            size=\"sm\" 
            onClick={fetchMetrics}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button 
            variant=\"outline\" 
            size=\"sm\" 
            onClick={runAnalysisTests}
            disabled={runningTests}
          >
            <TestTube className={`w-4 h-4 mr-1 ${runningTests ? 'animate-pulse' : ''}`} />
            Run Tests
          </Button>
        </div>
      </div>

      <Tabs defaultValue=\"overview\" className=\"space-y-6\">
        <TabsList>
          <TabsTrigger value=\"overview\">Overview</TabsTrigger>
          <TabsTrigger value=\"performance\">Performance</TabsTrigger>
          <TabsTrigger value=\"costs\">Costs & Usage</TabsTrigger>
          <TabsTrigger value=\"quality\">Quality</TabsTrigger>
          <TabsTrigger value=\"testing\">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value=\"overview\" className=\"space-y-6\">
          {/* Key Metrics Cards */}
          <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4\">
            <Card>
              <CardHeader className=\"flex flex-row items-center justify-between space-y-0 pb-2\">
                <CardTitle className=\"text-sm font-medium\">Total Requests</CardTitle>
                <Activity className=\"h-4 w-4 text-muted-foreground\" />
              </CardHeader>
              <CardContent>
                <div className=\"text-2xl font-bold\">{data.analysis.totalRequests.toLocaleString()}</div>
                <p className=\"text-xs text-muted-foreground\">
                  Cache hit rate: {data.analysis.cacheHitRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className=\"flex flex-row items-center justify-between space-y-0 pb-2\">
                <CardTitle className=\"text-sm font-medium\">Success Rate</CardTitle>
                <CheckCircle className=\"h-4 w-4 text-muted-foreground\" />
              </CardHeader>
              <CardContent>
                <div className=\"text-2xl font-bold\">{data.processing.successRate.toFixed(1)}%</div>
                <p className=\"text-xs text-muted-foreground\">
                  {data.processing.totalSuccessful} of {data.processing.totalProcessed} processed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className=\"flex flex-row items-center justify-between space-y-0 pb-2\">
                <CardTitle className=\"text-sm font-medium\">Average Cost</CardTitle>
                <DollarSign className=\"h-4 w-4 text-muted-foreground\" />
              </CardHeader>
              <CardContent>
                <div className=\"text-2xl font-bold\">${data.analysis.averageCostPerRequest.toFixed(4)}</div>
                <p className=\"text-xs text-muted-foreground\">
                  Total: ${data.analysis.totalCost.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className=\"flex flex-row items-center justify-between space-y-0 pb-2\">
                <CardTitle className=\"text-sm font-medium\">Processing Time</CardTitle>
                <Clock className=\"h-4 w-4 text-muted-foreground\" />
              </CardHeader>
              <CardContent>
                <div className=\"text-2xl font-bold\">{(data.processing.averageProcessingTime / 1000).toFixed(1)}s</div>
                <p className=\"text-xs text-muted-foreground\">
                  Currently processing: {data.systemHealth.currentlyProcessing}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Health & Recommendations */}
          <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Current system status and key indicators</CardDescription>
              </CardHeader>
              <CardContent className=\"space-y-4\">
                <div className=\"flex items-center justify-between\">
                  <span>Overall Status</span>
                  <Badge variant={data.systemHealth.status === 'healthy' ? 'default' : 'destructive'}>
                    {data.systemHealth.status}
                  </Badge>
                </div>
                
                <div className=\"space-y-2\">
                  <div className=\"flex justify-between text-sm\">
                    <span>Processing Success Rate</span>
                    <span>{data.processing.successRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={data.processing.successRate} className=\"h-2\" />
                </div>

                <div className=\"space-y-2\">
                  <div className=\"flex justify-between text-sm\">
                    <span>Cache Hit Rate</span>
                    <span>{data.analysis.cacheHitRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={data.analysis.cacheHitRate} className=\"h-2\" />
                </div>

                {data.circuitBreaker.isOpen && (
                  <Alert>
                    <AlertTriangle className=\"h-4 w-4\" />
                    <AlertDescription>
                      Circuit breaker is open due to API failures
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Automated suggestions for optimization</CardDescription>
              </CardHeader>
              <CardContent>
                {data.recommendations.length > 0 ? (
                  <ul className=\"space-y-2\">
                    {data.recommendations.map((rec, index) => (
                      <li key={index} className=\"flex items-start gap-2 text-sm\">
                        <Zap className=\"h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0\" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className=\"text-sm text-muted-foreground\">
                    No optimization recommendations at this time. System is performing well!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value=\"performance\" className=\"space-y-6\">
          <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
            <Card>
              <CardHeader>
                <CardTitle>Model Usage Distribution</CardTitle>
                <CardDescription>Distribution of requests across AI models</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width=\"100%\" height={300}>
                  <PieChart>
                    <Pie
                      data={modelDistributionData}
                      cx=\"50%\"
                      cy=\"50%\"
                      labelLine={false}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill=\"#8884d8\"
                      dataKey=\"value\"
                    >
                      {modelDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Categories</CardTitle>
                <CardDescription>Breakdown of processing errors by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width=\"100%\" height={300}>
                  <BarChart data={errorCategoryData}>
                    <CartesianGrid strokeDasharray=\"3 3\" />
                    <XAxis dataKey=\"category\" angle={-45} textAnchor=\"end\" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey=\"count\" fill=\"#ff7c7c\" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value=\"costs\" className=\"space-y-6\">
          <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-4\">
            <Card>
              <CardHeader>
                <CardTitle>Total Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className=\"text-3xl font-bold\">${data.analysis.totalCost.toFixed(2)}</div>
                <p className=\"text-sm text-muted-foreground mt-1\">
                  Across {data.analysis.totalRequests} requests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost per Request</CardTitle>
              </CardHeader>
              <CardContent>
                <div className=\"text-3xl font-bold\">${data.analysis.averageCostPerRequest.toFixed(4)}</div>
                <p className=\"text-sm text-muted-foreground mt-1\">
                  Average across all models
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className=\"text-3xl font-bold text-green-600\">
                  ${((data.analysis.totalRequests * 0.02) - data.analysis.totalCost).toFixed(2)}
                </div>
                <p className=\"text-sm text-muted-foreground mt-1\">
                  From intelligent model selection
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value=\"quality\" className=\"space-y-6\">
          <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
            <Card>
              <CardHeader>
                <CardTitle>Analysis Quality Metrics</CardTitle>
                <CardDescription>Quality indicators for analysis outputs</CardDescription>
              </CardHeader>
              <CardContent className=\"space-y-4\">
                <div className=\"space-y-2\">
                  <div className=\"flex justify-between text-sm\">
                    <span>Completion Rate</span>
                    <span>{data.database.completionRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={data.database.completionRate} className=\"h-2\" />
                </div>

                <div className=\"space-y-2\">
                  <div className=\"flex justify-between text-sm\">
                    <span>Analysis Rate</span>
                    <span>{data.database.analysisRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={data.database.analysisRate} className=\"h-2\" />
                </div>

                <div className=\"space-y-2\">
                  <div className=\"flex justify-between text-sm\">
                    <span>Error Rate</span>
                    <span>{data.analysis.errorRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={data.analysis.errorRate} className=\"h-2\" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Database Statistics</CardTitle>
                <CardDescription>Voice notes processing statistics</CardDescription>
              </CardHeader>
              <CardContent className=\"space-y-4\">
                <div className=\"grid grid-cols-2 gap-4 text-center\">
                  <div>
                    <div className=\"text-2xl font-bold\">{data.database.totalNotes}</div>
                    <div className=\"text-sm text-muted-foreground\">Total Notes</div>
                  </div>
                  <div>
                    <div className=\"text-2xl font-bold\">{data.database.processedNotes}</div>
                    <div className=\"text-sm text-muted-foreground\">Processed</div>
                  </div>
                  <div>
                    <div className=\"text-2xl font-bold\">{data.database.notesWithAnalysis}</div>
                    <div className=\"text-sm text-muted-foreground\">With Analysis</div>
                  </div>
                  <div>
                    <div className=\"text-2xl font-bold\">{data.analysis.cacheSize}</div>
                    <div className=\"text-sm text-muted-foreground\">Cached Results</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value=\"testing\" className=\"space-y-6\">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Testing</CardTitle>
              <CardDescription>
                Run automated tests to validate analysis quality and performance
              </CardDescription>
            </CardHeader>
            <CardContent className=\"space-y-4\">
              <div className=\"flex items-center gap-4\">
                <Button 
                  onClick={runAnalysisTests}
                  disabled={runningTests}
                >
                  {runningTests ? (
                    <>
                      <RefreshCw className=\"w-4 h-4 mr-2 animate-spin\" />
                      Running Tests...
                    </>
                  ) : (
                    <>
                      <TestTube className=\"w-4 h-4 mr-2\" />
                      Run All Tests
                    </>
                  )}
                </Button>
                
                <Button 
                  variant=\"outline\"
                  onClick={resetMetrics}
                >
                  <RefreshCw className=\"w-4 h-4 mr-2\" />
                  Reset Metrics
                </Button>
              </div>

              {testResults && (
                <div className=\"mt-6 space-y-4\">
                  <h3 className=\"text-lg font-semibold\">Test Results</h3>
                  
                  <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
                    <Card>
                      <CardContent className=\"pt-6\">
                        <div className=\"text-2xl font-bold text-center\">
                          {testResults.summary.successRate.toFixed(1)}%
                        </div>
                        <div className=\"text-sm text-center text-muted-foreground\">
                          Success Rate
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className=\"pt-6\">
                        <div className=\"text-2xl font-bold text-center\">
                          {testResults.summary.averageProcessingTime}ms
                        </div>
                        <div className=\"text-sm text-center text-muted-foreground\">
                          Avg Processing Time
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className=\"pt-6\">
                        <div className=\"text-2xl font-bold text-center\">
                          {testResults.summary.validation.validationRate.toFixed(1)}%
                        </div>
                        <div className=\"text-sm text-center text-muted-foreground\">
                          Validation Rate
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {testResults.summary.errors.length > 0 && (
                    <Alert>
                      <AlertTriangle className=\"h-4 w-4\" />
                      <AlertDescription>
                        {testResults.summary.errors.length} test(s) failed. 
                        Check the detailed results for more information.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}