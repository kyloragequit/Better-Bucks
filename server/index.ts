import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import { ensureStripeReady } from "./stripeLazy";
import { WebhookHandlers } from "./webhookHandlers";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.stack || err);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM signal");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT signal");
  process.exit(0);
});

process.on("SIGHUP", () => {
});

// Refuse to start in production without a real session secret
if (process.env.NODE_ENV === "production") {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "super secret session key" || secret.length < 32) {
    console.error("FATAL: SESSION_SECRET is not set or is insecure. Refusing to start in production.");
    process.exit(1);
  }
}

const app = express();
const httpServer = createServer(app);

// Trust the first proxy hop (Replit's reverse proxy) so rate limiters
// use the real client IP from X-Forwarded-For rather than the proxy's IP.
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Security headers (must be before routes)
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed separately; disabling avoids breaking Vite HMR in dev
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === "production"
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
}));

// Redirect HTTP → HTTPS in production (Replit sets X-Forwarded-Proto)
if (process.env.NODE_ENV === "production") {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers["x-forwarded-proto"] === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Stripe webhook must be before express.json() so it gets the raw buffer
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      await ensureStripeReady();
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Body parsers with explicit size limits (50kb prevents oversized payload attacks)
app.use(
  express.json({
    limit: "50kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50kb" }));

// General API rate limiter: 300 requests/minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});
app.use("/api", apiLimiter);

// Strict login rate limiter: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true,
});
app.use("/api/login", loginLimiter);
app.use("/api/developer-login", loginLimiter);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Global error handler — scrubs internal details from 500 responses in production
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error("Express error:", err.stack || err);

    if (status >= 500 && process.env.NODE_ENV === "production") {
      res.status(status).json({ message: "An unexpected error occurred." });
    } else {
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    }
  });

  if (process.env.NODE_ENV === "production") {
    const compression = (await import("compression")).default;
    app.use(compression());
    const { serveStatic } = await import("./static");
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
