# Build stage
FROM node:24-alpine AS build

WORKDIR /app

# Define build arguments for Vite
ARG VITE_PROJECT_TITLE
ARG VITE_API_URL=/api

# Set them as environment variables so Vite can see them during 'yarn build'
ENV VITE_PROJECT_TITLE=$VITE_PROJECT_TITLE
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies using yarn
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile

# Copy source and build
COPY . .
RUN yarn build

# Production stage
FROM nginx:stable-alpine

# Copy nginx config template (envsubst replaces ${SERVER_PORT} at container start)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy build output to nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
