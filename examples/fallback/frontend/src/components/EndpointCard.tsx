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
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
            checked ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
              checked ? 'translate-x-5' : 'translate-x-0.5'
            } mt-0.5`}
          />
        </button>
      </div>
      <code className="block text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
        {route}
      </code>
      {children}
    </div>
  )
}
