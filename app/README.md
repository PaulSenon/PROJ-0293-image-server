# Image Processing Service

A flexible image processing service that can run as an AWS Lambda function or as a standalone Node.js Express server.

## Features

- Resize images with various options (width, height, quality, format)
- Support for multiple output formats (JPEG, WebP, AVIF, PNG, JXL)
- Extract image metadata (EXIF, IPTC)
- Caching support with ETag
- Environment-agnostic core for maximum reusability

## Architecture

The service is structured with a clean architecture approach:

- **Core**: Contains the environment-agnostic image processing logic
- **Controllers**: 
  - AWS Lambda controller for serverless deployment
  - Express controller for standalone Node.js deployment

## Development

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- pnpm

### Setup Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd image-server/app

# Install dependencies
make install

# Start development server
make dev
```

### Environment Variables

- `BUCKET_NAME`: S3 bucket name for image storage
- `AWS_ENDPOINT`: S3 endpoint (for local development with MinIO)
- `AWS_REGION`: AWS region
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `PORT`: Port for Express server (default: 3001)

## API Usage

### Process an image

```
GET /images/process?uri=<image-path>&w=<width>&h=<height>&q=<quality>&type=<format>
```

Parameters:
- `uri`: Path to the image in S3 bucket (required)
- `w`: Width in pixels
- `h`: Height in pixels
- `q`: Quality (1-100)
- `type`: Output format (jpeg, webp, avif, png, jxl)
- `meta`: Set to 'true' to return image metadata instead of the processed image

### Health check

```
GET /images/health
```

## Deployment

### AWS Lambda

The service can be deployed as an AWS Lambda function:

1. **Build the Lambda deployment package**:
   ```bash
   # Navigate to the app directory
   cd image-server/app
   
   # Build the Lambda deployment package
   make run cmd="pnpm build:lambda"
   ```
   
   This creates a deployment package at `dist/lambda-deployment.zip` containing the Lambda function code and all dependencies.

2. **Integration with Infrastructure**:
   The infrastructure project is configured to reference this deployment package. After building the package,
   you can deploy it using the CDK stack in the `infrastructure` directory.
   
   See the [infrastructure README](../infrastructure/README.md) for detailed deployment instructions.

### Standalone Node.js

For running as a standalone Express server:

```bash
# Build the application
make build

# Start the server
make start
```

## License

MIT 