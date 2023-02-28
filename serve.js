import * as dotenv from 'dotenv'
import { startService } from './index.js'
dotenv.config()

const main = async () => {
  console.log(
    `[MONGO-FETCH-API] Starting Mongo data adapter service...`,
    `PORT: ${process.env.PORT || 3000}`
  )

  const connectionStrings = {}

  for (const key in process.env) {
    if (key.startsWith('MONGO_URI_')) {
      connectionStrings[key.split('MONGO_URI_')[1].toLowerCase()] = process.env[key]
    }
  }

  await startService(
    process.env.PORT || 3000,
    {
      readOnly: process.env.READ_ONLY_KEY,
      readWrite: process.env.READ_WRITE_KEY
    },
    connectionStrings
  )
}

main()