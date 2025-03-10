import express from "express";
import axios from "axios";
import { Request, Response } from "express";
import { Transform } from "stream";

const app = express();
const port = process.env.PORT || 8080;
const lambdaUrl =
  process.env.LAMBDA_URL ||
  "http://localhost:9000/2015-03-31/functions/lambda/invocations";

app.use(express.json());
app.use(express.raw({ type: "application/octet-stream" }));

// Set response headers
function setResponseHeaders(
  res: Response,
  statusCode: number,
  headers: Record<string, string> = {}
) {
  // Set status code
  res.status(statusCode);

  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

/**
 * Simplified implementation to extract metadata from the first chunk
 * Just looks for 8 consecutive null bytes as the separator
 */
function extractMetadataFromFirstChunkV2(chunk: Buffer): {
  metadata: any;
  rest: Buffer;
} {
  const PADDING_SIZE = 8;
  const NULL_SEQUENCE = Buffer.alloc(PADDING_SIZE); // Creates a buffer of 8 zeros

  // Find sequence of 8 null bytes
  for (let i = 0; i < chunk.length - PADDING_SIZE; i++) {
    if (chunk.subarray(i, i + PADDING_SIZE).equals(NULL_SEQUENCE)) {
      // Everything before is metadata
      const metadata = JSON.parse(chunk.subarray(0, i).toString());

      // Everything after is image data
      const rest = chunk.subarray(i + PADDING_SIZE);

      return { metadata, rest };
    }
  }

  throw new Error("Could not find padding sequence");
}

function extractMetadataFromFirstChunk(chunk: Buffer): {
  metadata: any;
  rest: Buffer;
} {
  const chunkStr = chunk.toString();
  // for each char, we count open and close braces until they are equal and then we have the metadata
  let openBraces = 0;
  let closeBraces = 0;
  let i = 0;

  do {
    if (chunkStr[i] === "{") openBraces++;
    if (chunkStr[i] === "}") closeBraces++;
    i++;
  } while (openBraces !== closeBraces && i < chunkStr.length);

  let imageDataStartIndex = i + 8;

  // Safety check to ensure we don't go beyond the buffer length
  if (imageDataStartIndex >= chunk.length) {
    imageDataStartIndex = i; // Fallback to no alignment if we'd go beyond the buffer
  }

  console.log("JSON ends at index:", i);
  console.log("Image data starts at index (aligned):", imageDataStartIndex);

  console.log("total chunk size", chunk.byteLength);
  // Get the JSON string and parse it
  const jsonStr = chunkStr.substring(0, i);
  const metadata = JSON.parse(jsonStr);

  // Extract the rest of the buffer after the JSON and padding
  const rest = chunk.subarray(imageDataStartIndex);
  console.log("metadata length", i);
  console.log("padding length", imageDataStartIndex - i);
  console.log("rest length", rest.byteLength);

  console.log("total", rest.byteLength + imageDataStartIndex);
  return { metadata, rest };
}

// Handle OPTIONS requests for CORS
app.options("*", (req, res) => {
  res.status(204);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-cache-key, if-none-match"
  );
  res.end();
});

app.all("*", async (req: Request, res: Response) => {
  try {
    if (req.path === "/favicon.ico") {
      res.status(204);
      res.end();
      return;
    }

    // Prepare API Gateway v2 format event payload
    const lambdaPayload = {
      httpMethod: req.method,
      headers: {
        "x-cache-key": "i".repeat(Math.random() * 1000),
      }, // req.headers,
      queryStringParameters: req.query,
      rawPath: req.path,
      // body: req.is("application/json")
      //   ? JSON.stringify(req.body)
      //   : req.body.toString("base64"),
    };

    console.log("Request:", {
      url: lambdaUrl,
      payload: lambdaPayload, // req.body,
    });

    // Simple approach: Buffer the response and handle it
    // Send the request to Lambda
    const lambdaResponse = await axios.post(lambdaUrl, lambdaPayload, {
      responseType: "stream",
    });

    // Set up error handling
    lambdaResponse.data.on("error", (err: Error) => {
      console.error("Lambda stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream error" });
      } else if (!res.writableEnded) {
        res.end();
      }
    });

    let isFirstChunk = true;
    lambdaResponse.data.on("data", (chunk: Buffer) => {
      if (isFirstChunk) {
        isFirstChunk = false;
        console.log("First chunk:", chunk.byteLength);
        const { metadata, rest } = extractMetadataFromFirstChunkV2(chunk);
        console.log("First chunk:", metadata);
        setResponseHeaders(res, metadata.statusCode, metadata.headers);
        res.write(rest);
        return;
      } else {
        res.write(chunk);
      }
    });

    lambdaResponse.data.on("end", () => {
      res.end();
    });
  } catch (error) {
    console.error("Error in request handler:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`API Gateway mock server listening at http://localhost:${port}`);
});
