FROM node:18-alpine

COPY . .

RUN yarn install --production

CMD ["yarn", "serve"]
