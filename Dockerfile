FROM node:20-slim

# Install Chromium
RUN apt-get update \
  && apt-get install -y chromium \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Tailscale
RUN apt-get update && apt-get install -y curl && curl -fsSL https://tailscale.com/install.sh | sh

RUN mkdir -p /var/run/tailscale /var/cache/tailscale


# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Puppeteer will use the system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=8080

EXPOSE 8080

CMD tailscaled & node server.js
