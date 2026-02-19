import type { ReactNode } from 'react'

interface EndpointCardProps {
  title: string
  route: string
  checked: boolean
  onToggle: () => void
  children?: ReactNode
}

export function EndpointCard({ title, route, checked, onToggle, children }: EndpointCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <label className="relative inline-block w-11 h-6">
          <input
            type="checkbox"
            className="opacity-0 w-0 h-0"
            checked={checked}
            onChange={onToggle}
          />
          <span className="toggle-slider" />
        </label>
      </div>
      <code className="block text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
        {route}
      </code>
      {children}
    </div>
  )
}
