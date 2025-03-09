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

### Lambda Container Configuration Fixes (Latest)
- Fixed port mapping in docker-compose.dev.yml from 3000:8080 to 9000:8080 for Lambda container
- Fixed Lambda container entrypoint configuration to properly pass the handler name
- Consolidated to a single docker-compose file (docker-compose.dev.yml) with all services
- Added necessary environment variables to Lambda container for local testing
- Improved Lambda container configuration to better emulate the AWS Lambda environment locally
- Fixed issues with entrypoint script execution in the Lambda container

### ES Modules in Lambda Fix (Latest)
- Fixed "Cannot use import statement outside a module" error in Lambda container
- Updated build-lambda.sh script to include package.json in the Lambda deployment package
- Added verification in Dockerfile.lambda-prod to ensure package.json has "type": "module"
- Ensured ES module compatibility throughout the build and deployment process
- Fixed port mapping in docker-compose.dev.yml to use port 9000 for the Lambda container

### Lambda Build Process Optimization (Latest)
- Switched from custom build script to esbuild for Lambda packaging:
  ```json
  "build:lambda": "esbuild src/lambdaEntrypoint.ts --bundle --minify --platform=node --target=es2022 --outfile=dist/index.js",
  "postbuild:lambda": "cd dist && zip -r lambda-deployment.zip index.js",
  ```
- This approach:
  - Bundles all code into a single file, eliminating module resolution issues
  - Significantly reduces package size by only including code that's actually used
  - Improves cold start performance
  - Resolves ES Module/CommonJS compatibility issues with AWS SDK
  - Follows AWS best practices for TypeScript Lambda functions

### Sharp with Lambda Considerations (Latest)
- Identified that Sharp requires special handling with Lambda due to its native binaries
- Sharp uses architecture-specific binaries that are resolved during installation
- Simply bundling Sharp with esbuild is insufficient
- Options for handling Sharp in Lambda:
  1. Using a Lambda Layer specifically built for the target architecture
  2. Building Sharp in a container matching the Lambda environment
  3. Using a pre-built Sharp package from repositories like pH200/sharp-layer
- Our ARM64 architecture in production requires additional consideration
- Need to ensure Sharp is properly packaged for Lambda's ARM64 environment

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

### ES Modules in Lambda
- The project uses ES Modules (import/export statements) instead of CommonJS
- Lambda deployment package must include package.json with `"type": "module"`
- Node.js runtime in Lambda needs this to correctly interpret ES Module syntax
- Both the Express and Lambda environments must use the same module system
- All imported modules must be included in the Lambda deployment package

### Sharp with AWS Lambda
- Sharp is a high-performance image processing library with native components
- It includes platform-specific binaries that are resolved during installation
- AWS Lambda requires binaries specific to its environment (e.g., ARM64 or x86_64)
- Options for handling Sharp in Lambda:
  - Using Lambda Layers (recommended approach)
  - Building in a matching container environment
  - External preprocessing of images
- Lambda Layers for Sharp are available (e.g., pH200/sharp-layer)
- Architecture-specific builds are necessary (ARM64 vs x86_64)

### Bundling with esbuild
- esbuild provides significant advantages for Lambda deployments:
  - Fast bundling of TypeScript code
  - Tree-shaking to eliminate unused code
  - Single file output without module resolution issues
  - Smaller package sizes for faster cold starts
  - Proper handling of ES Module/CommonJS compatibility
- AWS officially recommends esbuild for TypeScript Lambda functions
- Special consideration needed for native modules like Sharp
- Configuration options like `--external:sharp` can exclude problematic dependencies

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

When testing Lambda locally (after fix):
```
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{
  "version": "2.0",
  "rawPath": "/resize",
  "rawQueryString": "width=500&height=300&format=webp&quality=80&path=images/example.jpg",
  "headers": {
    "accept": "image/webp,image/*"
  },
  "requestContext": {
    "http": {
      "method": "GET"
    }
  },
  "isBase64Encoded": false
}'
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
- `make prod-express` - Run Express production container (with S3)
- `make prod-lambda` - Run Lambda production container (with S3)
- `make logs-express` - View Express container logs
- `make logs-lambda` - View Lambda container logs

## Next Steps
- Consider implementing a Lambda Layer approach for Sharp
- Test and optimize ARM64 compatibility for production
- Improve local testing of Lambda environment
- Evaluate performance metrics in production

## Future You Instructions
- Always update this file with any significant changes to the project
- Document any new architectural decisions or technical challenges
- Keep the commands section up to date with any new Makefile targets
- Document any new environment variables or configuration options
- Update deployment instructions if they change

## Current Implementation Status
- Express server is fully functional for local development and container-based testing
- Lambda implementation transitioning to esbuild bundling approach
- Need to address Sharp architecture-specific requirements for Lambda
- Investigating Lambda Layers as a solution for Sharp dependencies
