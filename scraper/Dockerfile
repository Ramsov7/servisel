FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package manifests first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production || npm install --production

# Copy rest of the application
COPY . .

# Create a non-root user and give ownership to avoid running as root
RUN useradd -m scraperuser && chown -R scraperuser /usr/src/app
USER scraperuser

# Default command
CMD ["node", "index.js"]
