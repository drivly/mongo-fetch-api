import { MongoClient } from 'mongodb'
import yaml from 'js-yaml'
import fs from 'fs'
import qs from 'qs'
import humanizeDuration from 'humanize-duration'
import fetch from 'node-fetch'
import { BSON, EJSON } from 'bson'
import { serve } from '@hono/node-server'
import { logger } from 'hono/logger'
import { Hono } from 'hono'

let config = {}
let bootTime = null

try {
	config = yaml.load(fs.readFileSync('config.yaml', 'utf8'))
} catch {}

const app = new Hono()

app.use(logger())

const clients = {}

const getClient = async (cluster) => {
	if (clients[cluster]) {
		return clients[cluster]
	}

	if (!config.mongoClusters[cluster]) {
		throw new Error(`Cluster ${cluster} not found`)
	}

	const client = await MongoClient.connect(
		config.mongoClusters[cluster]
	)

	clients[cluster] = client

	return client
}

const toEJSON = (doc) => {
	return JSON.parse(EJSON.stringify(doc))
}

app.get('/', async c => {
	const metadata = await fetch(
		'https://www.cloudflare.com/cdn-cgi/trace'
	).then(x => x.text())

	const colo = metadata.split('colo=')[1].split('\n')[0]

	return c.json({
		api: {
			icon: '📡',
			name: 'MongoDB Data API',
			description: 'A self-hosted clone of Atlas\'s Data API',
			repo: 'https://github.com/drivly/mongo-fetch-api',
			uptime: bootTime ? humanizeDuration(Date.now() - bootTime) : null,
			colocation: colo,
		},
		data: {
			clusters: Object.keys(config.mongoClusters)
		},
		user: {}
	})
})

app.all('/api/v1/action/:action', async c => {
	const auth = c.req.header('api-key')

	if (!auth) {
		return c.json({
			error: 'api-key header is required',
		}, 401)
	}

	console.log(
		config
	)

	let authPermissions = []

	if (auth === config.readWrite) {
		authPermissions = ['read', 'write']
	} else if (auth === config.readOnly) {
		authPermissions = ['read']
	} else {
		return c.json({
			error: 'Invalid api-key',
		}, 401)
	}

	const { action } = c.req.param()

	if (!action.includes('find') && !authPermissions.includes('write')) {
		return c.json({
			error: 'You do not have permission to write',
		}, 401)
	}

	let payload

	if (c.req.method === 'POST') {
		payload = await c.req.json()
	} else {
		payload = qs.parse(
			decodeURIComponent(new URLSearchParams(c.req.query()).toString())
		)
	}

	let {
		dataSource,
		database,
		collection,
		filter,
		pipeline,
		sort,
		limit,
		skip,
		projection,
		documents,
		document,
		update,
		updates,
	} = payload

	const options = {}

	if (sort) {
		options.sort = sort
	}

	if (limit) {
		options.limit = limit
	} else {
		options.limit = 1000
	}

	if (skip) {
		options.skip = skip
	}

	if (projection) {
		options.projection = projection
	}

	if (filter) filter = EJSON.parse(JSON.stringify(filter))

	const dbOnlyActions = [
		'listCollections',
		'listDatabases'
	]

	if (!dataSource) return c.json({ error: 'dataSource is required' }, 400)
	if (!database) return c.json({ error: 'database is required' }, 400)
	if (!collection && !dbOnlyActions.includes(action)) return c.json({ error: 'collection is required' }, 400)

	const client = await getClient(dataSource)

	if (collection) collection = client.db(database).collection(collection)

	let result

	try {
		switch (action) {
			case 'find':
				result = { documents: await collection.find(filter, options).toArray() }
				console.log(options)
				break
			case 'findOne':
				result = { document: await collection.findOne(filter, options) }
				break
			case 'insertOne':
				result = { insertedId: (await collection.insertOne(document)).insertedId }
				break
			case 'insertMany':
				result = { insertedIds: (await collection.insertMany(documents)).insertedIds }
				break
			case 'updateOne':
				result = await collection.updateOne(filter, update, options)
				break
			case 'updateMany':
				result = await collection.updateMany(filter, update)
				break
			case 'replaceOne':
				result = await collection.replaceOne(filter, document, options)
				break
			case 'deleteOne':
				result = await collection.deleteOne(filter, options)
				break
			case 'deleteMany':
				result = await collection.deleteMany(filter)
				break
			case 'aggregate':
				result = { documents: await collection.aggregate(pipeline).toArray() }
				break
			case 'countDocuments':
				result = { count: await collection.countDocuments(filter) }
				break
			case 'estimatedDocumentCount':
				result = { count: await collection.estimatedDocumentCount() }
				break
			case 'distinct':
				result = { values: await collection.distinct(filter) }
				break
			case 'listCollections':
				result = {
					collections: (await client.db(database).listCollections().toArray()).map(x => {
						return {
							name: x.name,
							type: x.type,
							options: x.options,
						}
					})
				}
				break
			case 'listDatabases':
				result = {
					databases: (await client.db().admin().listDatabases()).databases.map(x => {
						return {
							name: x.name,
							//sizeOnDisk: x.sizeOnDisk,
							empty: x.empty,
						}
					})
				}
				break
			default:
				return c.json({ error: 'Unknown action' })
		}
	} catch (e) {
		return c.json({ error: e.message }, 400)
	}

	return new Response(
		JSON.stringify(toEJSON(result)),
		{
			headers: {
				'Content-Type': 'application/ejson',
			}
		}
	)
})

export const startService = (port, opt, clusters) => {
	config = Object.assign(config || {}, opt || {})

	config.mongoClusters = {
		...config.mongoClusters,
		...clusters,
	}

	if (!config.readWrite) {
		console.warn(
			'[MONGO-FETCH-API] WARNING: readWrite is not set in config.yaml, you will not be able to write data without setting READ_WRITE_KEY in the environment.'
		)
	}

	console.log(
		`[MONGO-FETCH-API] Using clusters: ${Object.keys(config.mongoClusters).join(', ')}`
	)

	bootTime = Date.now()

	return serve({ fetch: app.fetch, port })
}