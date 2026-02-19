import { useState } from 'react'
import { MdArrowBack, MdArrowForward } from 'react-icons/md'
import { StatusBadge } from './StatusBadge'
import { EndpointCard } from './EndpointCard'
import { TestResult } from './TestResult'
import { useAdminStatus, type EndpointKey } from '../hooks/useAdminStatus'

const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE as string)

interface TestResultData {
  success: boolean
  status?: number
  data?: unknown
  error?: string
  url?: string
  displayName?: string
  timestamp?: string
}

type TestEndpointKey = 'main' | 'backup' | 'serp'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const { status, fetchStatus, toggleEndpoint } = useAdminStatus()

  const [testResults, setTestResults] = useState<Record<TestEndpointKey, TestResultData | null>>({
    main: null,
    backup: null,
    serp: null,
  })
  const [testing, setTesting] = useState<Record<TestEndpointKey, boolean>>({
    main: false,
    backup: false,
    serp: false,
  })
  const [flightId, setFlightId] = useState('FL001')
  const [serpDeparture, setSerpDeparture] = useState('CDG')
  const [serpArrival, setSerpArrival] = useState('AUS')

  const testEndpoint = async (endpoint: TestEndpointKey) => {
    setTesting((p) => ({ ...p, [endpoint]: true }))
    const url =
      endpoint === 'main'
        ? `${API_BASE}/api/flight/main/${flightId}`
        : endpoint === 'backup'
          ? `${API_BASE}/api/flight/backup/${flightId}`
          : `${API_BASE}/api/serp/flight_search?departure_id=${serpDeparture}&arrival_id=${serpArrival}`
    const displayName =
      endpoint === 'main' ? 'Main Endpoint' : endpoint === 'backup' ? 'Backup Endpoint' : 'SerpAPI'
    try {
      const res = await fetch(url)
      const data = await res.json()
      setTestResults((p) => ({
        ...p,
        [endpoint]: {
          success: res.ok,
          status: res.status,
          data,
          url,
          displayName,
          timestamp: new Date().toISOString(),
        },
      }))
    } catch (e) {
      setTestResults((p) => ({
        ...p,
        [endpoint]: {
          success: false,
          error: e instanceof Error ? e.message : String(e),
          displayName,
          timestamp: new Date().toISOString(),
        },
      }))
    } finally {
      setTesting((p) => ({ ...p, [endpoint]: false }))
    }
  }

  const testButton = (endpoint: TestEndpointKey, isLoading: boolean) => (
    <button
      className="px-3.5 py-1.5 text-[13px] font-semibold text-white bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-md cursor-pointer whitespace-nowrap transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={() => testEndpoint(endpoint)}
      disabled={isLoading}
    >
      {isLoading ? '…' : 'Test'}
    </button>
  )

  return (
    <>
      {/* Toggle button */}
      <button
        className={`fixed top-3 z-30 w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center transition-all duration-150 text-base ${
          open
            ? 'left-[364px] bg-white/80 text-[#667eea] border border-gray-200 hover:bg-white max-md:left-auto max-md:right-3'
            : 'left-3 bg-white/20 text-white border border-white/30 backdrop-blur hover:bg-white/35'
        }`}
        onClick={onToggle}
        title={open ? 'Hide controls' : 'Show controls'}
      >
        {open ? <MdArrowBack /> : <MdArrowForward />}
      </button>

      {/* Drawer */}
      <aside
        className={`relative z-20 h-screen bg-white/95 backdrop-blur-md border-r border-gray-200 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden shrink-0 ${
          open ? 'w-[360px] max-md:fixed max-md:w-full max-md:z-40' : 'w-0'
        }`}
      >
        <div className="w-[360px] max-md:w-full h-full overflow-y-auto p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">API Controls</h2>
            <button
              className="px-3.5 py-1.5 text-xs font-semibold text-[#667eea] bg-[#eef2ff] border border-[#c7d2fe] rounded-lg hover:bg-[#e0e7ff] hover:border-[#a5b4fc] transition-all"
              onClick={fetchStatus}
            >
              Refresh
            </button>
          </div>

          {/* Status grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatusBadge label="Server" on={status.serverEnabled} />
            <StatusBadge label="Main" on={status.mainEndpointEnabled} />
            <StatusBadge label="Backup" on={status.backupEndpointEnabled} />
            <StatusBadge label="SerpAPI" on={status.serpApiEnabled} />
          </div>

          {/* Main Endpoint */}
          <EndpointCard
            title="Main Endpoint"
            route="/api/flight/main/:id"
            checked={status.mainEndpointEnabled}
            onToggle={() => toggleEndpoint('main' as EndpointKey, status.mainEndpointEnabled)}
          >
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md outline-none focus:border-[#667eea] transition-colors"
                value={flightId}
                onChange={(e) => setFlightId(e.target.value)}
                placeholder="FL001"
              />
              {testButton('main', testing.main)}
            </div>
            <TestResult result={testResults.main} />
          </EndpointCard>

          {/* Backup Endpoint */}
          <EndpointCard
            title="Backup Endpoint"
            route="/api/flight/backup/:id"
            checked={status.backupEndpointEnabled}
            onToggle={() => toggleEndpoint('backup' as EndpointKey, status.backupEndpointEnabled)}
          >
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md outline-none focus:border-[#667eea] transition-colors"
                value={flightId}
                onChange={(e) => setFlightId(e.target.value)}
                placeholder="FL001"
              />
              {testButton('backup', testing.backup)}
            </div>
            <TestResult result={testResults.backup} />
          </EndpointCard>

          {/* SerpAPI */}
          <EndpointCard
            title="SerpAPI"
            route="/api/serp/flight_search"
            checked={status.serpApiEnabled}
            onToggle={() => toggleEndpoint('serp' as EndpointKey, status.serpApiEnabled)}
          >
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md outline-none focus:border-[#667eea] transition-colors"
                value={serpDeparture}
                onChange={(e) => setSerpDeparture(e.target.value)}
                placeholder="CDG"
              />
              <input
                type="text"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md outline-none focus:border-[#667eea] transition-colors"
                value={serpArrival}
                onChange={(e) => setSerpArrival(e.target.value)}
                placeholder="AUS"
              />
              {testButton('serp', testing.serp)}
            </div>
            <TestResult result={testResults.serp} />
          </EndpointCard>
        </div>
      </aside>
    </>
  )
}
