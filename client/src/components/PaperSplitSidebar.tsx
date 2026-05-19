import { Scrollbar } from 'lifeforge-ui'
import type { ReactNode } from 'react'

function PaperSplitSidebar({ children }: { children: ReactNode }) {
  return (
    <aside
      className="bg-bg-50 shadow-custom border-bg-500/20 xl:component-bg dark:bg-bg-900 shrink-0 rounded-lg py-4 backdrop-blur-xs in-[.bordered]:border-2"
      style={{
        flex: '0 0 24rem',
        height: 'calc(100% - 2rem)',
        minWidth: '24rem',
        position: 'relative',
        width: '24rem'
      }}
    >
      <Scrollbar usePaddingRight={false}>
        <ul className="flex size-full min-w-0 flex-col gap-0.5">{children}</ul>
      </Scrollbar>
    </aside>
  )
}

export default PaperSplitSidebar
