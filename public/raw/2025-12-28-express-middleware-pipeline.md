# Express Middleware Pipeline

> Understanding Express middleware - functions that transform requests as they flow through your app, why order matters, and how to build reusable request processing logic.

---
Type: post
Date: 2025-12-28
Reading time: 10 min read
Tags: Middleware, Express, Request Pipeline, Next Function, Middleware Order
---

# Express Middleware Pipeline

In the last tutorial, you learned that requests flow through your server. But here's what we didn't cover: **how does that request get transformed along the way?**

Think of middleware like an **assembly line** for requests. Each station does something specific - add a tracking number, check authentication, validate data - then passes it to the next station.

Understanding middleware is the difference between "my routes work" and "I know exactly what's happening to every request at every step."

## The Problem: Your Request Goes Through Many Stages

Look at your request route in `src/routes/request.routes.ts:531-536`:

```typescript
router.get(
  "/",
  validateRequest(getRequestsQuerySchema),
  cache({ duration: 60 }),
  requestController.getAll
);
```

You see three things before your controller runs. What do they do? In what order? What happens if one fails?

**Without understanding middleware, you're flying blind.** You won't know:
- Where to add logging
- How to handle errors globally
- Why your auth isn't working
- When validation happens vs caching

Let's demystify middleware.

## Key Concepts

### What is Middleware?

**Middleware is just a function.** That's it.

Every middleware function has the same shape:

```typescript
(req: Request, res: Response, next: NextFunction) => {
  // Do something with the request
  next(); // Pass to next middleware
}
```

Three parameters:
- **req** - The incoming request (you can read or modify it)
- **res** - The outgoing response (you can send a response)
- **next** - A function that calls the next middleware

**The key insight:** Middleware runs **in order**. Each one can:
1. Do something (log, validate, add data to `req`)
2. Call `next()` to pass control
3. OR send a response (stop the chain)

### The Assembly Line Mental Model

Think of your request as a product moving through an assembly line:

```
┌─────────────────────────────────────────────────────────────┐
│                  MIDDLEWARE PIPELINE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Request arrives → [Middleware 1] → [Middleware 2] → ... → [Handler]  │
│                        ↓                  ↓                   ↓         │
│                    Add ID           Check Auth          Send Response │
│                    next()           next()                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Each middleware:
1. Receives the request
2. Does its job
3. Calls `next()` OR sends a response

**If any middleware sends a response, the chain stops.** That's why `next()` is so important.

### The `next()` Function: The Gatekeeper

`next()` is how you say "I'm done, pass it along."

```typescript
// GOOD: Pass to next middleware
(req, res, next) => {
  req.timestamp = new Date();
  next(); // ← Moves to next middleware
}

// BAD: Never calls next() - request hangs forever!
(req, res, next) => {
  req.timestamp = new Date();
  // Oops, forgot next() - client waits forever!
}

// ALSO VALID: Send response, no next() needed
(req, res, next) => {
  if (!req.headers.token) {
    res.status(401).json({ error: "No token" });
    return; // ← Chain ends here
  }
  next(); // ← Only called if token exists
}
```

**Rule of thumb:** If you're not sending a response, you MUST call `next()`. Otherwise the request hangs.

### Why Order Matters (Critical!)

Middleware runs in the order you define it. This is **CRITICAL**.

```typescript
// WRONG: Auth before requestId
app.use(requireAuth);       // Fails if no user on req
app.use(requestId);         // Adds ID to req (but never runs if auth fails!)

// RIGHT: requestId before auth
app.use(requestId);         // Always runs first
app.use(requireAuth);       // Now runs after ID is added
```

**Your app gets this right** in `src/app.ts:62-88`:

```typescript
// Security (always runs)
setupSecurityHeaders(app);
app.use(cors());

// Performance (processes body)
app.use(compressionMiddleware);
app.use(express.json({ limit: "10kb" }));

// Monitoring (logs everything)
app.use(loggingMiddleware);
app.use(metricsMiddleware);

// Rate limiting (protects routes)
app.use("/api/v1/auth", authLimiter);
app.use("/api/v1", apiLimiter);
```

See the logic? Security first, then body parsing, then logging, then rate limiting. **Order is intentional.**

### Error-Handling Middleware: The Four-Parameter Pattern

There's a special type of middleware for errors. It has **4 parameters** instead of 3:

```typescript
(error: Error, req: Request, res: Response, next: NextFunction) => {
  // Handle the error
}
```

Express detects the 4 parameters and treats it differently: it only runs when an error occurs.

Look at your `src/middleware/errorHandler.ts:11-44`:

```typescript
export const errorHandler = (
  error: Error,          // ← First param = error
  req: Request,
  res: Response,
  _next: NextFunction    // ← Still needs 4 params to be recognized
): void => {
  logger.error({
    message: error.message,
    stack: error.stack,
    context: "ErrorHandler",
  });

  const statusCode = error instanceof AppError ? error.statusCode : 500;

  if (error instanceof AppError) {
    ApiResponse.error(res, arabicMessage, statusCode, error.code);
    return;
  }

  ApiResponse.error(res, messages.errors.internalServerError, 500);
};
```

This is your **global error handler**. Any middleware that calls `next(error)` skips to this handler.

**Error flow:**
```
Middleware 1 → Middleware 2 → [ERROR!] → Error Handler → Response
                 next(error) ────────────────────────────────┘
```

## Examples from Codebase

### Example 1: Request ID Middleware (Simple)

**Location:** `src/middleware/requestId.ts:12-16`

```typescript
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = (req.headers["x-request-id"] as string) || uuidv4();
  res.setHeader("X-Request-ID", req.requestId);
  next();
};
```

**What's happening:**

1. Check if client sent a `X-Request-ID` header
2. If not, generate a random UUID
3. Attach it to `req.requestId` (for other middleware to use)
4. Add it to response header (so client can track it)
5. Call `next()` to pass control

**Why this is brilliant:** Every request now has a unique ID. When you see logs, you can trace a single request through your entire system.

**Usage in your app:** `src/app.ts:64`
```typescript
app.use(requestId);  // Runs on EVERY request
```

---

### Example 2: Auth Middleware (Can Stop Chain)

**Location:** `src/middleware/authMiddleware.ts:22-51`

```typescript
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw new AppError("No token provided", 401, ErrorCode.UNAUTHORIZED);
    }
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
    req.user = decoded;  // ← Attach user to request
    next();              // ← Pass to next middleware
  } catch (error) {
    next(error);  // ← Pass error to error handler
  }
};
```

**What's happening:**

1. Extract JWT token from `Authorization` header
2. If no token, throw error → goes to error handler
3. Verify token with JWT secret
4. Attach decoded user to `req.user` (controllers can use this!)
5. Call `next()` if successful

**Key insight:** This middleware **modifies the request** by adding `req.user`. Downstream middleware/controllers can access `req.user.userId`, `req.user.role`, etc.

---

### Example 3: Higher-Order Middleware (Middleware Factory)

**Location:** `src/middleware/cacheMiddleware.ts:9-23`

```typescript
export const cache = (options: CacheOptions = {}) => {
  const duration = options.duration || 300;

  return (req: Request, res: Response, next: NextFunction) => {
    if (ENV.NODE_ENV === "production" && req.method === "GET") {
      res.set(
        "Cache-Control",
        `${options.private ? "private" : "public"}, max-age=${duration}`
      );
    } else {
      res.set("Cache-Control", "no-store");
    }
    next();
  };
};
```

**What's happening:**

This is a **middleware factory** - a function that returns middleware.

```typescript
// You call it WITH options:
cache({ duration: 60 })

// It RETURNS a middleware function:
(req, res, next) => { /* ... */ }
```

**Why?** So you can configure each route differently:

```typescript
// Cache for 60 seconds
router.get("/", cache({ duration: 60 }), handler);

// Cache for 5 minutes (default)
router.get("/other", cache(), handler);

// Private cache (browser only, not CDNs)
router.get("/profile", cache({ duration: 300, private: true }), handler);
```

---

### Example 4: Validation Middleware (Can Fail Fast)

**Location:** `src/middleware/validateRequest.ts:7-45`

```typescript
export const validateRequest = (schema: AnyZodObject, target: 'body' | 'query' | 'params' | 'all' = 'all') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      let dataToValidate;

      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        // ... other cases
      }

      schema.parse(dataToValidate);  // ← Zod validation
      next();                        // ← Only runs if valid
    } catch (error) {
      if (error instanceof ZodError) {
        const arabicMessage = translateValidationError(originalMessage);
        next(new ValidationError(arabicMessage));  // ← Fail with error
        return;
      }
      next(new ValidationError(messages.errors.invalidRequestData));
    }
  };
};
```

**What's happening:**

1. Receives a Zod schema (validation rules)
2. Returns middleware that validates specific part of request
3. If validation passes → `next()` (continue)
4. If validation fails → `next(error)` (skip to error handler)

**Usage in your routes:** `src/routes/request.routes.ts:322-324`

```typescript
router.post(
  "/",
  validateRequest(createRequestSchema),  // ← Validates req.body
  requestController.create                // ← Only runs if valid
);
```

**Why this matters:** Your controller **never receives invalid data**. It's rejected at the middleware level before reaching your business logic.

---

### Example 5: Role-Based Authorization (Higher-Order + Route Protection)

**Location:** `src/middleware/authMiddleware.ts:53-75`

```typescript
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user?.role || !roles.includes(req.user.role)) {
        throw new AppError(
          "Forbidden - Insufficient permissions",
          403,
          ErrorCode.FORBIDDEN
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

**What's happening:**

1. Takes an array of allowed roles: `["SUPER_ADMIN", "MAINTENANCE_ADMIN"]`
2. Returns middleware that checks `req.user.role`
3. If user's role is in allowed list → `next()`
4. If not → 403 Forbidden error

**Usage in your routes:** `src/routes/request.routes.ts:965-970`

```typescript
router.post(
  "/:id/assign",
  requireRole(["SUPER_ADMIN", "MAINTENANCE_ADMIN"]),  // ← Only these roles
  validateRequest(assignRequestSchema),
  requestController.assign
);
```

**Only admins can assign requests.** Technicians and customers are blocked at the middleware level.

## Try It Yourself

**Exercise: Create a Logging Middleware**

1. Create a new file `src/middleware/customLogger.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { logger } from "@/config/logger";

export const customLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log when request arrives
  logger.info({
    method: req.method,
    path: req.path,
    query: req.query,
    requestId: req.requestId,
  });

  // Listen for response finishing
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId,
    });
  });

  next();
};
```

2. Add it to `src/app.ts` (around line 83, after other middleware):

```typescript
import { customLogger } from "@/middleware/customLogger";

// Add it after requestId middleware
app.use(customLogger);
```

3. Make a request and watch your logs:
```bash
npm run dev
# Then in another terminal:
curl http://localhost:3000/health
```

**What you'll learn:**
- How middleware intercepts both request AND response
- The `res.on("finish")` pattern for post-response logging
- How to access `req` properties from previous middleware
- Why middleware placement matters (put it after `requestId` so logs show the ID!)

**Bonus challenge:** Modify the middleware to skip logging for `/health` endpoints. (Hint: check `req.path` before logging)

## Summary

**The mental model you now have:**

* **Middleware** is just a function with `(req, res, next)` parameters
* The `next()` function passes control to the next middleware in the chain
* **Order matters** - middleware runs in the sequence you define it
* Middleware can **modify requests** (add data), **send responses**, or **pass errors**
* **Error-handling middleware** has 4 parameters and catches `next(error)` calls
* **Higher-order middleware** (factories) return middleware functions for configuration

**Common middleware patterns:**
- **Request modification:** Add data to `req` for downstream use
- **Validation:** Check data, fail fast if invalid
- **Authentication:** Verify identity, add user to `req`
- **Authorization:** Check permissions, block unauthorized access
- **Logging:** Record request/response data
- **Caching:** Set cache headers on response
- **Error handling:** Catch and format errors

**Common pitfalls:**
- Forgetting to call `next()` - request hangs forever
- Middleware in wrong order - auth runs before body is parsed
- Sending response AND calling `next()` - causes "headers already sent" errors
- Not handling errors in middleware - uncaught promise rejections

You now understand the pipeline architecture that powers Express. Every request you make flows through this chain, and you can modify, validate, or block requests at any point. This is the foundation of building robust, secure backend systems.

---

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]