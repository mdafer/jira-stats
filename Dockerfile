# Build stage
FROM node:24-alpine AS build

WORKDIR /app

# Define build arguments for Vite
ARG VITE_JIRA_DOMAIN
ARG VITE_JIRA_EMAIL
ARG VITE_JIRA_TOKEN
ARG VITE_JIRA_JQL
ARG VITE_PROJECT_TITLE

# Set them as environment variables so Vite can see them during 'yarn build'
ENV VITE_JIRA_DOMAIN=$VITE_JIRA_DOMAIN
ENV VITE_JIRA_EMAIL=$VITE_JIRA_EMAIL
ENV VITE_JIRA_TOKEN=$VITE_JIRA_TOKEN
ENV VITE_JIRA_JQL=$VITE_JIRA_JQL
ENV VITE_PROJECT_TITLE=$VITE_PROJECT_TITLE

# Install dependencies using yarn
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile

# Copy source and build
COPY . .
RUN yarn build

# Production stage
FROM nginx:stable-alpine

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output to nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
