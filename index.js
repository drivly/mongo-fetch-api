import { MongoClient } from 'mongodb'
import yaml from 'js-yaml'
import fs from 'fs'
import qs from 'qs'
import { BSON, EJSON } from 'bson'
import { serve } from '@hono/node-server'
import { logger } from 'hono/logger'
import { Hono } from 'hono'

const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'))

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
	const { action } = c.req.param()

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
		sort,
		limit,
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

	if (!dataSource) return c.json({ error: 'dataSource is required' })
	if (!database) return c.json({ error: 'database is required' })
	if (!collection) return c.json({ error: 'collection is required' })

	const client = await getClient(dataSource)
	collection = await client.db(database).collection(collection)

	let result

	switch (action) {
		case 'find':
			result = { documents: await collection.find(filter, options).toArray() }
			break
		case 'findOne':
			result = { document: await collection.findOne(filter, projection || {}, options) }
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
		default:
			return c.json({ error: 'Unknown action' })
	}

	return c.json(toEJSON(result))
})

export const startService = (port) => serve({ fetch: app.fetch, port })