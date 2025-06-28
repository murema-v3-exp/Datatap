import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { processFullPayment, finalizeOutgoingPayment } from "./open-payments";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "./public")));

app.get("/", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "/index.html"));
});

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Initiate a payment (Step 1 - returns redirect URL and continuation data)
app.post("/api/pay", async (req: Request, res: Response): Promise<any> => {
  const { senderWalletUrl, receiverWalletUrl, amount } = req.body;

  if (!senderWalletUrl || !receiverWalletUrl || !amount) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Missing senderWalletUrl, receiverWalletUrl or amount",
      received: req.body,
    });
  }

  try {
    const result = await processFullPayment({
      senderWalletUrl,
      receiverWalletUrl,
      amount,
    });

    res.json({
      status: "grant_pending",
      message: "User must authorize grant",
      redirectUrl: result.redirectUrl,
      continuation: result.continuation,
      incomingPayment: result.incomingPayment,
      quote: result.quote,
    });
  } catch (err) {
    console.error("Error processing payment:", err);
    res.status(500).json({ error: "Failed to initiate Open Payments flow" });
  }
});

// Finalize and execute the outgoing payment (Step 2 - called after user accepts grant)
app.post("/api/finalize-payment", async (req: Request, res: Response): Promise<any> => {
  const { uri, accessToken, senderWalletAddress, quoteId } = req.body;

  if (!uri || !accessToken || !senderWalletAddress || !quoteId) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Missing uri, accessToken, senderWalletAddress, or quoteId",
      received: req.body,
    });
  }

  try {
    const result = await finalizeOutgoingPayment({
      uri,
      accessToken,
      senderWalletAddress,
      quoteId,
    });

    res.json({
      status: "success",
      message: "Payment completed successfully",
      outgoingPayment: result,
    });
  } catch (err) {
    console.error("Error finalizing payment:", err);
    res.status(500).json({ error: "Failed to finalize payment" });
  }
});

app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "Something went wrong",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Express server running on http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💳 Pay start:    POST http://localhost:${PORT}/api/pay`);
  console.log(`💳 Pay finalize: POST http://localhost:${PORT}/api/finalize-payment`);
});

export default app;
