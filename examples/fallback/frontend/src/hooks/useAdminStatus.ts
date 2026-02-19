import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE as string)

interface AdminStatus {
  serverEnabled: boolean
  mainEndpointEnabled: boolean
  backupEndpointEnabled: boolean
  serpApiEnabled: boolean
}

export type EndpointKey = 'server' | 'main' | 'backup' | 'serp'

export function useAdminStatus() {
  const [status, setStatus] = useState<AdminStatus>({
    serverEnabled: true,
    mainEndpointEnabled: true,
    backupEndpointEnabled: true,
    serpApiEnabled: true,
  })

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/status`)
      setStatus(await res.json())
    } catch (e) {
      console.error('Failed to fetch status:', e)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const toggleEndpoint = async (endpoint: EndpointKey, currentState: boolean) => {
    const action = currentState ? 'disable' : 'enable'
    const url =
      endpoint === 'server'
        ? `${API_BASE}/api/admin/server/${action}`
        : endpoint === 'serp'
          ? `${API_BASE}/api/admin/serp/${action}`
          : `${API_BASE}/api/admin/endpoint/${endpoint}/${action}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) await fetchStatus()
    } catch (e) {
      console.error(`Failed to toggle ${endpoint}:`, e)
    }
  }

  return { status, fetchStatus, toggleEndpoint }
}
