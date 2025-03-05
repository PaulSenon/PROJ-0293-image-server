# [YOUR PROJECT NAME]

This is a CDK Typescript infrastructure (fully dockerized) for [...]

## Requirements

- docker
- docker compose
- make

## Install dependencies

```bash
make install
```

the first time you will be prompted to configure the aws sdk with the account you want to use. It works with both sso or access keys.

## Cleanup (to remove all generated files and save space)

```bash
make clean
```

## Force Rebuild in case of issues

```bash
make install-force
```

## Enter dev env (to run any command like cdk, npm, aws, etc   )

```bash
make dev
# that is a alias for
make bash
```

but if you don't want to enter the dev env bash, you can run this others make commands that are shortcut you can run from you host machine:

### CDK Commands

| Command | Description |
|---------|-------------|
| `make cdk-bootstrap` | Bootstrap CDK in your AWS account |
| `make cdk-synth` | Synthesize CloudFormation template |
| `make cdk-diff` | Show changes to be deployed |
| `make cdk-deploy` | Deploy the CDK stack |
| `make cdk-destroy` | Destroy the CDK stack |

### AWS Commands

| Command | Description |
|---------|-------------|
| `make aws-configure` | Configure AWS profile (sso or access key & secret) |
| `make aws-login` | Login to AWS SSO |

### Docker Commands

| Command | Description |
|---------|-------------|
| `make docker-build` | Build the Docker image |
| `make docker-build-force` | Build the Docker image without cache |
| `make docker-build-debug` | Build the Docker image with debug output |
| `make docker-clean` | Remove Docker containers, images, and volumes |
| `make docker-down` | Stop all containers |

### Package Manager Commands

| Command | Description |
|---------|-------------|
| `make npm-install` | Install dependencies |
| `make npm-upgrade` | Upgrade all dependencies |
| `make npm-clean` | Clean dependencies and generated files |

### Other Commands

| Command | Description |
|---------|-------------|
| `make corepack-upgrade` | Upgrade corepack to the latest version |
| `make run cmd="..."` | Run arbitrary command in dev container without entering it (from host then)|
| `make help` | Display help with all available commands |

## Lambda Function Deployment

This infrastructure project is designed to work with the Lambda deployment package created by the `image-server/app` project.

### Complete Deployment Process

1. **Step 1: Build the Lambda Function**
   ```bash
   # Navigate to app directory
   cd ../app
   
   # Build the Lambda function
   make run cmd="pnpm build:lambda"
   ```
   This creates the deployment package at `image-server/app/dist/lambda-deployment.zip`

2. **Step 2: Deploy the Infrastructure**
   ```bash
   # Navigate back to the infrastructure directory
   cd ../infrastructure
   
   # Deploy using CDK
   make cdk-deploy
   ```

### Key Details:

- The Lambda function definition in the CDK stack references the deployment package at `../../image-server/app/dist/lambda-deployment.zip`
- The handler is set to `index.handler` to match the exports in the bundled code
- The infrastructure handles provisioning all necessary AWS resources (IAM roles, CloudFront distribution, etc.)

### Integration Points

- **Handler**: The infrastructure expects the Lambda deployment package to export a handler function at `index.handler`
- **Environment Variables**: The infrastructure provides the following environment variables to the Lambda function:
  - `BUCKET_NAME`: S3 bucket name for image storage
  - `NODE_OPTIONS`: Set to `--enable-source-maps` for better error reporting

### Troubleshooting

If deployment fails with an error about missing Lambda code:
1. Ensure you've built the Lambda deployment package in the app directory
2. Check that the path `../../image-server/app/dist/lambda-deployment.zip` is accessible from the infrastructure directory
3. Verify the handler name matches the exported function in your code

## CDK Commands
