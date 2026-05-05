import { Icon } from '@iconify/react'
import { Button } from 'lifeforge-ui'
import { useTranslation } from 'react-i18next'
import { useMainSidebarState } from 'shared'

import { MODULE_NAMESPACE } from '@/utils/module'

function PaperLibraryHeader({
  actionButton,
  icon,
  pageKey,
  totalItems
}: {
  actionButton?: React.ReactNode
  icon?: string
  pageKey: string
  totalItems?: number
}) {
  const { t } = useTranslation(MODULE_NAMESPACE)
  const { toggleSidebar, sidebarExpanded } = useMainSidebarState()

  return (
    <header className="flex-between mb-6 flex w-full min-w-0 gap-8">
      <div className="flex w-full min-w-0 items-center gap-2">
        {!sidebarExpanded && (
          <Button
            className="flex sm:hidden"
            icon="tabler:menu"
            variant="plain"
            onClick={toggleSidebar}
          />
        )}
        {icon !== undefined && (
          <div className="bg-custom-500/20 border-custom-500/30 flex size-14 shrink-0 items-center justify-center rounded-lg in-[.bordered]:border-2 sm:size-16">
            <Icon className="text-custom-500 size-8" icon={icon} />
          </div>
        )}
        <div className="w-full min-w-0 sm:space-y-1">
          <h1 className="flex w-full min-w-0 items-end gap-3 text-2xl font-semibold whitespace-nowrap sm:text-3xl">
            <span className="block truncate">{t(`${pageKey}.title`)}</span>
            <span className="text-bg-500 min-w-0 text-sm font-medium sm:text-base">
              {totalItems !== undefined ? `(${totalItems.toLocaleString()})` : ''}
            </span>
          </h1>
          <div className="text-bg-500 w-full min-w-0 truncate text-sm whitespace-nowrap sm:text-base">
            {t(`${pageKey}.description`)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">{actionButton}</div>
    </header>
  )
}

export default PaperLibraryHeader
