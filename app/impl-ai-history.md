# Project Implementation History - Image Server

## Project Context
This is part of a larger fullstack monorepo project with:
- Headless serverless CMS (Payload)
- Serverless ISR web frontend (Astro)
- Serverless image resize service (Lambda x Node x Sharp) - This subproject
- Serverless native app server

Key goals:
- Production-ready infrastructure
- Low cost, high performance
- Easy to maintain, scale, deploy, test, migrate, monitor, secure
- Near zero cost when not in use
- Fully featured CMS, great UX/DX
- High-end CI/CD, fully dockerized dev environment

## Image Server Project Evolution

### Initial MVP
- Created a working MVP with CDK infrastructure
- Implemented basic image resizing functionality in JavaScript
- Set up Lambda deployment

### New TypeScript Implementation
- Moved from JavaScript to TypeScript for better type safety
- Created a directory structure separating domain logic from infrastructure
- Implemented a clean architecture approach with separate entrypoints:
  - `localEntrypoint.ts` for Express server (local development)
  - `lambdaEntrypoint.ts` for AWS Lambda (production)
- Set up build process for Lambda deployment
- Created Docker development environment

### Current State (Latest Changes)
- Initial implementation in `/src/_new` was moved to the root of `/src`
- Two entrypoints directly in the src directory:
  - `src/localEntrypoint.ts` for Express server (local development)
  - `src/lambdaEntrypoint.ts` for Lambda (streaming) for production
- Updated build script at `scripts/build-lambda.sh` to reference correct file paths
- Docker production containers set up for both Express and Lambda environments

### Production Docker Configurations (2024-03-09)
- Created Dockerfile.express-prod for standalone Express server
- Created Dockerfile.lambda-prod for Lambda streaming-compatible container
- Added docker-compose.prod.yml for local testing of both containers
- Updated Makefile with commands for building and running production containers
- Fixed build script and Docker configurations to handle the new file structure

### Docker Build Fixes (2024-03-09)
- Added `zip` package installation to Lambda Dockerfile to enable creating deployment packages
- Added `curl` package installation to Express Dockerfile for health checks
- Fixed path references in Dockerfiles to match the new directory structure
- Modified Lambda Dockerfile to use a regular Node.js image for the builder stage instead of the Lambda image for better build tool availability
- Removed obsolete `version` attribute from docker-compose.prod.yml
- Improved Lambda container build by extracting the zip file in the builder stage and copying files directly to the Lambda image

## Technical Notes

### TypeScript Path Resolution
- Import paths require `.js` extension even for TypeScript files
- This happens because:
  1. Node.js ESM requires explicit file extensions (unlike CommonJS)
  2. TypeScript doesn't transform import paths during compilation
  3. TypeScript configuration uses modern module resolution (NodeNext/ESNext)

### Lambda Streaming
- The project uses Lambda streaming for image processing
- No API Gateway is used; instead, direct Lambda function URL invocation
- `lambda-stream` package is used to handle streaming responses
- Key classes:
  - `LambdaFunctionUrlStreamHandler` manages Lambda streaming
  - `ExpressStreamHandler` provides Express-compatible server

### Docker Container Strategy
- Development environment: Uses dev container with hot reloading
- Production Express: Containerized Express server for local testing
- Production Lambda: Container compatible with AWS Lambda for testing before deployment
  - Build stage: Uses regular Node.js image for better build tool availability
  - Final stage: Uses AWS Lambda runtime image for compatibility
  - Build process: Files are extracted in the builder stage and copied directly to the Lambda image
- Both production containers are self-contained and don't require external volume mounts

## Lambda vs Express URLs

Lambda Function URL format:
```
https://{function-url-id}.lambda-url.{region}.on.aws?key=params
```

Express server URL format:
```
http://localhost:3000/resize?width=300&height=200&format=webp&quality=80&path=path/to/image.jpg
```

## Important Commands

### Development
- `make dev` - Start development server
- `make build` - Build the TypeScript project
- `make build-lambda` - Build Lambda deployment package

### Production Testing
- `make docker-prod-build` - Build production Docker images
- `make prod-express` - Run Express production container
- `make prod-lambda` - Run Lambda production container
- `make logs-express` - View Express container logs
- `make logs-lambda` - View Lambda container logs

## Future You Instructions
- Always update this file with any significant changes to the project
- Document any new architectural decisions or technical challenges
- Keep the commands section up to date with any new Makefile targets
- Document any new environment variables or configuration options
- Update deployment instructions if they change

## Current Implementation Status
- Express server is fully functional for local development
- Lambda implementation requires testing for streaming compatibility
- Docker production containers are configured but need testing
