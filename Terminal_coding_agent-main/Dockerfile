FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

USER node

# The same image is reused by the CLI, API, and worker containers.
CMD ["node", "/app/dist/cli.js"]
