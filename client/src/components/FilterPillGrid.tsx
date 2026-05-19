import { Icon } from '@iconify/react'

interface FilterPillGridProps {
  icon: string
  items: string[]
  selected: string[]
  onToggle: (item: string) => void
}

function FilterPillGrid({ icon, items, selected, onToggle }: FilterPillGridProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const active = selected.includes(item)

        return (
          <button
            key={item}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition-colors ${
              active
                ? 'border-custom-500/30 bg-custom-500/15 text-custom-500'
                : 'border-bg-500/10 bg-component-bg text-bg-500 hover:border-custom-500/25 hover:text-bg'
            }`}
            type="button"
            onClick={() => onToggle(item)}
          >
            <Icon className="size-3 shrink-0" icon={icon} />
            <span className="truncate">{item}</span>
          </button>
        )
      })}
    </div>
  )
}

export default FilterPillGrid
