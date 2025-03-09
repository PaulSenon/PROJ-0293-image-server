import { streamifyResponse } from "lambda-stream";
import { LambdaFunctionUrlStreamHandler } from "./infrastructure/primary/LambdaFunctionUrlStreamHandler.js";

const lambdaHandler = new LambdaFunctionUrlStreamHandler();
export const handler = streamifyResponse(
  lambdaHandler.handle.bind(lambdaHandler)
);
