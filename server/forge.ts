import { createForge } from '@lifeforge/server-utils'

import schema from './schema'
import { MODULE_ID } from './utils/constants'

const forge = createForge(schema, MODULE_ID)

export default forge
