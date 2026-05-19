import { Scrollbar } from 'lifeforge-ui'
import type { ReactNode } from 'react'

function PaperSplitSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="bg-bg-50 shadow-custom border-bg-500/20 xl:component-bg dark:bg-bg-900 flex h-full min-h-0 w-96 min-w-96 shrink-0 flex-col overflow-hidden rounded-lg py-4 backdrop-blur-xs in-[.bordered]:border-2">
      <Scrollbar usePaddingRight={false}>
        <ul className="flex flex-1 flex-col gap-0.5 px-2 pb-4">{children}</ul>
      </Scrollbar>
    </aside>
  )
}

export default PaperSplitSidebar
