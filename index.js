import { MongoClient } from 'mongodb'
import yaml from 'js-yaml'
import fs from 'fs'
import qs from 'qs'
import { BSON, EJSON } from 'bson'
import { serve } from '@hono/node-server'
import { logger } from 'hono/logger'
import { Hono } from 'hono'

let config = {}

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

app.get('/', c => c.text('Hello World!'))

const toEJSON = (doc) => {
	return JSON.parse(EJSON.stringify(doc))
}

app.all('/api/v1/action/:action', async c => {
	const auth = c.req.header('api-key')

	if (!auth) {
		return c.json({
			error: 'api-key header is required',
		}, 401)
	}

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
				result = await collection.deleteMany(filter, options)
				break
			case 'aggregate':
				result = { documents: await collection.aggregate(pipeline).toArray() }
				break
			case 'countDocuments':
				result = { count: await collection.countDocuments(filter) }
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

	return serve({ fetch: app.fetch, port })
}