FROM node:16 AS builder

RUN apt update

WORKDIR /app

COPY . .

#COPY ./src /app/src

RUN npm install
RUN npm run build

# step2
FROM node:16-alpine

WORKDIR /app

COPY --from=builder /app ./

CMD ["npm", "run", "start"]