#!/bin/bash
set -e

# Build the TypeScript code
echo "Building TypeScript code..."
pnpm run build

# Create the Lambda deployment package
echo "Creating Lambda deployment package..."
LAMBDA_DIR="dist/lambda"
mkdir -p $LAMBDA_DIR

# Copy the Lambda handler
echo "Copying Lambda handler..."
cp dist/lambdaEntrypoint.js $LAMBDA_DIR/index.js

# Copy dependencies
echo "Copying dependencies..."
cp -r node_modules $LAMBDA_DIR/

# Create a zip file for deployment
echo "Creating zip file for deployment..."
cd $LAMBDA_DIR
zip -r ../lambda-deployment.zip .
cd -

echo "Lambda deployment package created at dist/lambda-deployment.zip" 