FROM node:24-alpine

WORKDIR /app

COPY server/package.json server/yarn.lock* ./server/
RUN cd server && yarn install --frozen-lockfile

COPY server/ ./server/

RUN mkdir -p server/data

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
