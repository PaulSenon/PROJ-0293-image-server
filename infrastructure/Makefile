# Set Bash as the shell so that Bash-specific syntax works
SHELL := /bin/bash

# Load environment variables in order of precedence (later files override earlier ones)
# The -include directive will silently ignore missing files
-include .env
-include .env.local

# Export all variables
export

.PHONY: install clean dev run aws-configure-check aws-configure aws-login cdk-bootstrap cdk-synth cdk-diff cdk-deploy cdk-destroy

# Docker configuration
COMPOSE_PROJECT_NAME = image-server-infra
DOCKER_COMPOSE_DIR = docker/dev
DOCKER_IMAGE_NAME = dev-env
DOCKER_COMPOSE_FILE = $(DOCKER_COMPOSE_DIR)/docker-compose.dev.yml

# Docker run command that includes environment variables
COMPOSE = docker compose --file $(DOCKER_COMPOSE_FILE) --project-name $(COMPOSE_PROJECT_NAME)
RUN_IN_DEV_ENV = $(COMPOSE) run --rm --service-ports $(DOCKER_IMAGE_NAME)

# Helper function to run commands in dev container
define run_in_dev_container_smart
	@if [ $$( $(COMPOSE) ps --status running --services | grep -c $(DOCKER_IMAGE_NAME)) -gt 0 ]; then \
		echo "Dev container already running, executing directly..."; \
		$(COMPOSE) exec $(DOCKER_IMAGE_NAME) $(1); \
	else \
		echo "Starting dev container and running command..."; \
		$(RUN_IN_DEV_ENV) $(1) && \
		echo "Stopping dev container..."; \
		$(MAKE) stop; \
	fi
endef

.PHONY: install install-force dev bash run clean stop

install: create-env-files verify-env docker-build npm-install aws-configure-check ## Install everything needed for development
install-force: create-env-files verify-env docker-build-force npm-install aws-configure ## Install everything needed for development

stop: ## Stop all containers
	@echo "Cleaning up unused containers..."; \
	$(COMPOSE) down --remove-orphans

dev: ## Start a development shell (alias to bash)
	@$(MAKE) bash

bash: verify-env ## Start a development shell
	$(call run_in_dev_container_smart,bash)

run: ## Run arbitrary command in dev-env container eg. make run cmd="npm run test"
	$(call run_in_dev_container_smart,$(cmd))

clean: npm-clean docker-clean ## Clean everything (containers, dependencies, generated files)

# AWS CLI Commands
aws-configure-check: ## Check if AWS profile is configured (fallback on aws-configure if not)
	@echo "Checking AWS profile configuration..."
	@$(RUN_IN_DEV_ENV) aws configure list >/dev/null 2>&1 || ( \
		echo "No AWS profile configured. Running aws-configure to set up credentials"; \
		$(MAKE) aws-configure; \
		exit 1 \
	)
	@echo "✓ AWS profile configured"

aws-configure: ## Configure AWS profile (sso or access key & secret)
	@echo "Choose AWS authentication method:"
	@echo "1) SSO login"
	@echo "2) Default credentials (access key & secret)"
	@read -p "Enter choice (1 or 2): " choice; \
	case $$choice in \
		1) \
			echo "Configuring AWS SSO..."; \
			$(RUN_IN_DEV_ENV) aws configure sso --profile $(AWS_PROFILE) --use-device-code --no-browser;; \
		2) \
			echo "Configuring AWS credentials..."; \
			$(RUN_IN_DEV_ENV) aws configure --profile $(AWS_PROFILE);; \
		*) \
			echo "Invalid choice"; \
			exit 1;; \
	esac
	@echo "✓ AWS profile configured"

aws-login:
	$(call run_in_dev_container_smart,aws sso login --profile $(AWS_PROFILE) --use-device-code --no-browser)

# CDK commands
cdk-bootstrap: ## Bootstrap CDK in your AWS account
	$(call run_in_dev_container_smart,$(PACKAGE_MANAGER) cdk bootstrap)

cdk-synth: ## Synthesize CloudFormation template
	$(call run_in_dev_container_smart,$(PACKAGE_MANAGER) cdk synth)

cdk-diff: ## Show changes to be deployed
	$(call run_in_dev_container_smart,$(PACKAGE_MANAGER) cdk diff)

cdk-deploy: ## Deploy the CDK stack
	$(call run_in_dev_container_smart,$(PACKAGE_MANAGER) cdk deploy --require-approval never)

cdk-destroy: ## Destroy the CDK stack
	$(call run_in_dev_container_smart,$(PACKAGE_MANAGER) cdk destroy --force)


# Docker commands
docker-build: ## Build the Docker image
	$(COMPOSE) build

docker-build-force: ## Build the Docker image without cache
	$(COMPOSE) build --no-cache

docker-build-debug: ## Build the Docker image with debug output
	$(COMPOSE) build --no-cache --progress=plain

docker-clean: ## Remove Docker containers, images, and volumes
	$(COMPOSE) down --rmi all --volumes --remove-orphans

docker-down: ## Stop all containers ()
	$(COMPOSE) down --remove-orphans


# Node package manager commands (run inside container)
npm-install: ## Install dependencies
	$(call run_in_dev_container_smart,$(PACKAGE_MANAGER) install)

npm-upgrade: ## Upgrade all dependencies
	$(call run_in_dev_container_smart,$(PACKAGE_MANAGER) upgrade && $(PACKAGE_MANAGER) install)

npm-clean: ## Clean dependencies and generated files
	$(call run_in_dev_container_smart,$(PACKAGE_MANAGER) run clean)


# Miscellaneous Commands
corepack-upgrade: ## Upgrade corepack to the latest version (use when you see that a newer version current package manager is available)
	$(call run_in_dev_container_smart,corepack up)


# Internal Utility Commands
create-env-files: ## Create a .env file for development
	@if [ ! -f .env.local ]; then \
		echo "#######################################################" > .env.local; \
		echo "# LOCAL SECRETS ONLY SHOULD NEVER BE COMMITTED        #" >> .env.local; \
		echo "# -> for non sensitive envs, use the .env file        #" >> .env.local; \
		echo "#######################################################" >> .env.local; \
	fi

verify-env: ## Verify environment variables are set
	@echo "Verifying environment variables..."
	@test -n "$(AWS_PROFILE)" || (echo "AWS_PROFILE is not set" && exit 1)
	@test -n "$(PACKAGE_MANAGER)" || (echo "PACKAGE_MANAGER is not set" && exit 1)
	@echo "Environment variables verified ✓"

help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help 