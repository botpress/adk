interface TestResultData {
  success: boolean
  status?: number
  data?: unknown
  error?: string
  url?: string
  displayName?: string
  timestamp?: string
}

interface TestResultProps {
  result: TestResultData | null
}

export function TestResult({ result }: TestResultProps) {
  if (!result) return null
  return (
    <div
      className={`rounded-md p-2.5 border ${
        result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
      }`}
    >
      <span
        className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded mb-1.5 ${
          result.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
        }`}
      >
        {result.success ? 'OK' : 'FAIL'} {result.status ?? 'ERR'}
      </span>
      <pre className="text-[11px] leading-snug bg-white p-2 rounded overflow-x-auto max-h-[140px] overflow-y-auto m-0 text-gray-700">
        {JSON.stringify(result.data ?? result.error, null, 2)}
      </pre>
    </div>
  )
}
