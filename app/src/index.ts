import express from "express";
import { router as imageRouter } from "./controllers/node/expressController.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// CORS headers
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, X-Cache-Key"
  );
  next();
});

// Routes
app.use("/images", imageRouter);

// Root route
app.get("/", (_req, res) => {
  res.json({
    message: "Image Processing Service",
    version: "1.0.0",
    endpoints: {
      images: {
        process:
          "/images/process?uri=<image-path>&w=<width>&h=<height>&q=<quality>&type=<format>",
        health: "/images/health",
      },
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
