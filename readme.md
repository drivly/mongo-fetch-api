# Mongo Fetch API - Self-hosted Data API
An almost 1-to-1 mapping of the MongoDB Atlas Data API to a self-hosted server. This allows you to run your own data API in whatever cloud provider you wish, fly.io, DigitalOcean, etc.

You can connect and use this API as if it were native MongoDB by using our [Data API driver](https://github.com/drivly/mongo-fetch). This allows you to access MongoDB data from edge-compute services like Cloudflare Workers.

## Why?
MongoDB Atlas Data API is a great service, but because its based on AWS Lambda, its very slow. This is because it has to spin up a new instance of the lambda function for every request. This is fine for small amounts of data, but for larger amounts of data, it can take a long time to return the data.

This project aims to solve that problem by running the API on a server, and using MongoDB's native driver to connect to the database. This means that the server can keep a connection open to the database, and the data can be streamed directly to the client. At the cost of always running. However, this is a small price to pay for the performance gains.

## Installing and running

#### Import
```js
import { createService } from '@drivly/mongo-fetch-api'

const main = async () => {
  await createService(
    3000, // port
    {
      readOnly: 'readonlykey',
      readWrite: 'secret'
    },
    {
      cluster1: 'mongodb://localhost:27017',
      cluster2: 'mongodb://localhost:27018'
    }
  )
}

main()
```

#### Node
```bash
git clone https://github.com/drivly/mongo-fetch-api.git

cd mongo-fetch-api

npm install

npm run serve
```

#### Docker
```bash
git clone https://github.com/drivly/mongo-fetch-api.git

cd mongo-fetch-api

docker build -t mongo-fetch-api .

docker run -p 3000:3000 -e READ_ONLY_KEY=readonlykey -e READ_WRITE_KEY=secret -e MONGO_URI_CLUSTER1=mongodb://localhost:27017 -e MONGO_URI_CLUSTER2=mongodb://localhost:27018 mongo-fetch-api
```

## Environment variables

`READ_ONLY_KEY` - The key used to authenticate read-only requests, will refuse any action other than find.  

`READ_WRITE_KEY` - The key used to authenticate read-write requests.  

`PORT` - The port to run the server on.  

`MONGO_URI_${clusterName}` - The URL to connect to the MongoDB instance. Replace `${clusterName}` with the name of the cluster. This will be used as the "dataSource" field in the request.  

e.g. `MONGO_URI_CLUSTER1=mongodb://localhost:27017`

means you can access it via:

```curl
POST /api/v1/action/findOne?dataSource=CLUSTER1&database=...&collection=...
```
