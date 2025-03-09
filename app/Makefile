# Set Bash as the shell so that Bash-specific syntax works
SHELL := /bin/bash

# Load environment variables in order of precedence (later files override earlier ones)
# this is the same loading logic as nodejs
# The -include directive will silently ignore missing files
-include .env
-include .env.local
-include .env.development 
-include .env.development.local

# Export all variables
export

.PHONY: install clean dev bash docker-build logs run test build build-lambda prod-express prod-lambda

COMPOSE_PROJECT_NAME = image-server-app
DOCKER_COMPOSE_FILE = ./docker/docker-compose.dev.yml
# DOCKER_COMPOSE_PROD_FILE = ./docker/docker-compose.prod.yml
COMPOSE = docker compose --file $(DOCKER_COMPOSE_FILE) --project-name $(COMPOSE_PROJECT_NAME)
# COMPOSE_PROD = docker compose --file $(DOCKER_COMPOSE_PROD_FILE) --project-name $(COMPOSE_PROJECT_NAME)-prod

# Helper function to run commands in dev container 
define RUN_IN_DEV_ENV
	@if [ $$( $(COMPOSE) ps --status running --services | grep -c dev) -gt 0 ]; then \
		echo "Container already running, executing directly..."; \
		$(COMPOSE) exec dev $(1); \
	else \
		echo "Starting and running command in new container..."; \
		$(COMPOSE) run --rm --service-ports dev $(1) && \
		echo "Stopping container..."; \
		$(MAKE) stop; \
	fi
endef

install: create-env-files docker-build pnpm-install ## Install everything needed for development
install-force: create-env-files docker-build-force pnpm-install

clean: pnpm-clean docker-clean ## Clean everything (containers, dependencies, generated files)
	rm -rf dist

stop: ## Stop all containers
	@echo "Cleaning up unused containers..."; \
	$(COMPOSE) down --remove-orphans

dev: ## Start the development server
	$(call RUN_IN_DEV_ENV,pnpm run dev)

bash: ## Attach to running container or start new instance
	$(call RUN_IN_DEV_ENV,bash)

run: ## Run arbitrary command in dev container eg. make run cmd="pnpm add package"
	$(call RUN_IN_DEV_ENV,$(cmd))

test: ## Run tests
	$(call RUN_IN_DEV_ENV,pnpm run test)

build: ## Build the project
	$(call RUN_IN_DEV_ENV,pnpm run build)

build-lambda: ## Build the lambda deployment package
	$(call RUN_IN_DEV_ENV,pnpm run build:lambda)

prod-express: docker-prod-build ## Run only the Express production container
	$(COMPOSE) up iso-prod-express

prod-lambda: docker-prod-build ## Run only the Lambda production container
	$(COMPOSE) up iso-prod-lambda

# Logs Commands
logs: ## View container logs
	$(COMPOSE) logs -f dev

logs-express: ## View Express server logs
	$(COMPOSE) logs -f iso-prod-express

logs-lambda: ## View Lambda server logs
	$(COMPOSE) logs -f iso-prod-lambda

# Docker commands
docker-build: ## Build the Docker image
	$(COMPOSE) build

docker-build-force: ## Build the Docker image with force flag
	$(COMPOSE) build --no-cache

docker-build-debug: ## Build the Docker image with debug output
	$(COMPOSE) build --no-cache --progress=plain

docker-clean: ## Remove Docker containers, images, and volumes
	$(COMPOSE) down --rmi all --volumes --remove-orphans

# PNPM commands (run inside container)
pnpm-install: ## Install pnpm dependencies
	$(call RUN_IN_DEV_ENV,pnpm install)

pnpm-clean: ## Clean pnpm dependencies and generated files
	$(call RUN_IN_DEV_ENV,pnpm run clean)

# Internal Utility Commands
create-env-files: ## Create a .env file for development
	@if [ ! -f .env.local ]; then \
		echo "#######################################################" > .env.local; \
		echo "# LOCAL SECRETS ONLY SHOULD NEVER BE COMMITTED        #" >> .env.local; \
		echo "# -> for non sensitive envs, use the .env file        #" >> .env.local; \
		echo "#######################################################" >> .env.local; \
	fi

	@if [ ! -f .env.development.local ]; then \
		echo "############################################################" > .env.development.local; \
		echo "# LOCAL SECRETS ONLY SHOULD NEVER BE COMMITTED             #" >> .env.development.local; \
		echo "# -> for non sensitive envs, use the .env.development file #" >> .env.development.local; \
		echo "############################################################" >> .env.development.local; \
	fi

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help 

%: # Catch-all target to allow passing arguments
	@: 