import startServer from "./ExpressStreamHandler.js";
import dotenv from "dotenv";

// Load environment variables from .env files
dotenv.config();

// Define the port to listen on (default to 3000 if not specified)
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Start the server
const server = startServer(PORT);

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});
