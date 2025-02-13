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
