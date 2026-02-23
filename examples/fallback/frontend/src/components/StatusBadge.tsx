interface StatusDotProps {
  on: boolean
}

const StatusDot = ({ on }: StatusDotProps) => (
  <span
    className={`w-2 h-2 rounded-full shrink-0 ${
      on
        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
        : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]'
    }`}
  />
)

interface StatusBadgeProps {
  label: string
  on: boolean
}

export function StatusBadge({ label, on }: StatusBadgeProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-700 border ${
        on ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
      }`}
    >
      <StatusDot on={on} />
      {label}
    </div>
  )
}
