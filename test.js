import FetchPolyfill from 'node-fetch'
import test from 'ava'
import { createMongoDBDataAPI } from 'mongodb-data-api'

import { startService } from './index.js'

globalThis.fetch = globalThis.fetch || FetchPolyfill

startService(3000)

const api = createMongoDBDataAPI({
  apiKey: 'Bearer a04d9045-cded-4968-b304-886aa41779c2',
  urlEndpoint: 'http://localhost:3000/api/v1'
})

test('main', async t => {
	const doc = await api.findOne({
    dataSource: 'logs',
    database: 'ctx-do',
    collection: 'logs'
  })

	console.log(
		'DOCUMENT',
		doc
	)
})
