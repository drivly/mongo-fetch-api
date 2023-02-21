import { startService } from './index.js'

const main = async () => {
  console.log(`[SERVICE] Starting Mongo data adapter service...`)
  await startService(
    3000
  )
}

main()