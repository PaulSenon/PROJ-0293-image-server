# Dockerfile
FROM node:20

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./
# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Expose the port the app runs in
EXPOSE 8080

# Command to run the application
CMD ["npm", "start"]
