#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ImageServerStack } from "./stacks/image-server-stack";

const app = new cdk.App();

// Define required environment variables and their types
const REQUIRED_ENV_VARS = {
  environment: "CDK_ENVIRONMENT",
  projectName: "CDK_PROJECT_NAME",
  costCenter: "CDK_COST_CENTER",
  stackName: "CDK_STACK_NAME",
  region: "AWS_REGION",
  cmsStackName: "CDK_CMS_STACK_NAME",
  imageProcessorMemorySize: "IMAGE_PROCESSOR_MEMORY_SIZE",
  imageProcessorTimeout: "IMAGE_PROCESSOR_TIMEOUT",
  cloudfrontPriceClass: "CLOUDFRONT_PRICE_CLASS",
} as const;

type EnvVarKey = keyof typeof REQUIRED_ENV_VARS;
type EnvVarName = (typeof REQUIRED_ENV_VARS)[EnvVarKey];
type EnvVars = Record<EnvVarKey, string>;

// Helper function to get environment variable with error handling
function getRequiredEnvVar(name: EnvVarName): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

// Get all required environment variables
const envVars = Object.entries(REQUIRED_ENV_VARS).reduce(
  (acc, [key, envName]) => ({
    ...acc,
    [key]: getRequiredEnvVar(envName),
  }),
  {} as EnvVars
);

// AWS environment
const env = {
  region: envVars.region,
} satisfies cdk.Environment;

// Create the Image Server stack
new ImageServerStack(app, envVars.stackName, {
  env,
  projectName: envVars.projectName,
  environment: envVars.environment,
  costCenter: envVars.costCenter,
  description: `${envVars.projectName} Image Server infrastructure stack for ${envVars.environment} environment`,
  tags: {
    Project: envVars.projectName,
    Environment: envVars.environment,
    ManagedBy: "CDK",
    CostCenter: envVars.costCenter,
  },
  // Resource configuration
  imageProcessor: {
    memorySize: parseInt(envVars.imageProcessorMemorySize, 10),
    timeout: parseInt(envVars.imageProcessorTimeout, 10),
  },
  cloudfront: {
    priceClass: parseInt(envVars.cloudfrontPriceClass, 10),
  },
  // Future CMS integration
  cmsStackName: envVars.cmsStackName,
});

app.synth();
