import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/routes";
import healthRouter from "./routes/health";
import { ensureStripeReady } from "./stripeLazy";
import { WebhookHandlers } from "./webhookHandlers";

const isProduction = process.env.NODE_ENV === "production";

const app: Express = express();
export const httpServer: Server = createServer(app);

// Trust first proxy hop (Replit's reverse proxy)
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  }),
);

// HTTP → HTTPS and www redirect in production
if (isProduction) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers["x-forwarded-proto"] === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = req.headers.host || "";
    if (host.startsWith("www.")) {
      const nonWww = host.slice(4);
      return res.redirect(301, `https://${nonWww}${req.url}`);
    }
    next();
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Security-Policy", "upgrade-insecure-requests");
    next();
  });
}

// Stripe webhook — must be before body parsers to get raw buffer
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }
    try {
      await ensureStripeReady();
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        logger.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer");
        return res.status(500).json({ error: "Webhook processing error" });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error({ err: error }, "Webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

// CORS
app.use(cors());

// Body parsers with size limits
app.use(
  express.json({
    limit: "50kb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 600 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});
app.use("/api", apiLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 30 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true,
});
app.use("/api/login", loginLimiter);
app.use("/api/developer-login", loginLimiter);

// Health check — mounted before registerRoutes so it's always available
app.use("/api", healthRouter);

export async function initApp(): Promise<void> {
  const compression = (await import("compression")).default;
  app.use(compression({ level: 6, threshold: 1024 }));

  await registerRoutes(httpServer, app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    logger.error({ err }, "Express error");
    if (status >= 500 && isProduction) {
      res.status(status).json({ message: "An unexpected error occurred." });
    } else {
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    }
  });
}

export default app;
