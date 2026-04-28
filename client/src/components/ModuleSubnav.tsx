import { Icon } from '@iconify/react'
import { Link, useLocation } from 'shared'

import { MODULE_BASE_PATH } from '@/utils/module'

const NAV_ITEMS = [
  {
    label: 'Papers',
    icon: 'tabler:books',
    path: ''
  },
  {
    label: 'Favorites',
    icon: 'tabler:star',
    path: '/favorites'
  },
  {
    label: 'Review',
    icon: 'tabler:file-search',
    path: '/abstract-review'
  },
  {
    label: 'Import',
    icon: 'tabler:file-import',
    path: '/import'
  },
  {
    label: 'Run',
    icon: 'tabler:player-play',
    path: '/run'
  },
  {
    label: 'Settings',
    icon: 'tabler:settings',
    path: '/settings'
  }
] as const

function isItemActive(pathname: string, itemPath: string) {
  if (!itemPath) {
    return pathname === MODULE_BASE_PATH
  }

  return pathname.startsWith(`${MODULE_BASE_PATH}${itemPath}`)
}

function ModuleSubnav() {
  const location = useLocation()

  return (
    <div className="sticky top-3 z-20 mb-6 flex justify-center">
      <div className="backdrop-blur-lg bg-component-bg/70 shadow-sm overflow-x-auto rounded-lg border border-bg-500/10 px-2 py-2">
        <div className="flex min-w-max items-center justify-center gap-2">
          {NAV_ITEMS.map(item => {
            const active = isItemActive(location.pathname, item.path)

            return (
              <Link
                key={item.path || '/'}
                className={[
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-custom-500/15 text-custom-500 shadow-sm'
                    : 'text-bg-500 hover:bg-component-bg-lighter hover:text-custom-500'
                ].join(' ')}
                to={`${MODULE_BASE_PATH}${item.path}`}
              >
                <Icon className="h-4 w-4" icon={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ModuleSubnav
