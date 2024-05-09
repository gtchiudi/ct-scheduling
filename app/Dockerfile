# Use an official Node.js runtime as the base image
FROM node:16-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

RUN npm install

# Copy the rest of the application code to the working directory
COPY . ./

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "build"]
