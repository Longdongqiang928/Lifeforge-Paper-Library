import { Navigate } from 'shared'
import { MODULE_BASE_PATH } from '@/utils/module'

function RunPage() {
  return <Navigate to={`${MODULE_BASE_PATH}/settings`} />
}

export default RunPage
