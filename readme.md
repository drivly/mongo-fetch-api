# Mongo Data API - Self-hosted
Ever wanted to host your own version of Mongo's Data API? Now you can!

## Installing and running

`npm i @drivly/mongo-fetch-api`

`npm run serve`

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