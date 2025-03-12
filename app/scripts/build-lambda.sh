#!/bin/bash
set -e

echo "Building using Docker builder stage..."
docker build --no-cache --platform linux/arm64 --target output -f docker/Dockerfile.lambda-prod -t lambda-builder .

echo "Extracting build artifacts..."
docker create --name temp-builder lambda-builder
mkdir -p dist/lambda
docker cp temp-builder:/output/build.zip ./dist/lambda/build.zip
docker rm temp-builder

echo "Lambda deployment package created at dist/lambda/build.zip"

echo "Cleaning up..."
docker rmi lambda-builder
