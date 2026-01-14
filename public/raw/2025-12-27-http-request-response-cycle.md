# HTTP Request/Response Cycle

> Understanding the fundamental request/response cycle that powers the web - what happens when you click a button, what a server actually does, and how Express routes handle incoming requests.

---
Type: post
Date: 2025-12-27
Reading time: 10 min read
Tags: HTTP, Server, Request, Response, Express, Routing
---

# HTTP Request/Response Cycle

You built this backend with AI assistance. It works. But do you know *why* it works?

Every time your frontend makes an API call, something magical happens. A request leaves the browser, travels across the internet, hits your server, and comes back with data. Understanding this flow is what separates someone who copies code from someone who can build anything.

Let's demystify what's actually happening.

## The Problem: Your App Does This Thousands of Times

Look at your frontend making an API call to fetch maintenance requests:

```typescript
// Frontend calls this:
fetch('/api/v1/maintenance-requests?page=1&limit=10')
```

And your backend responds with data. Simple, right?

But here's what **actually happens** in that split second:

1. Browser creates an **HTTP GET request**
2. Request travels through the internet to your server
3. Your server's **Express app** receives it
4. Express matches the URL to a **route handler**
5. Your controller queries the database
6. Database returns data
7. Your controller sends back an **HTTP response**
8. Response travels back through the internet
9. Browser receives and parses the JSON

If you don't understand this flow, you're flying blind. Let's break it down.

## Key Concepts

### What is a Server, Really?

Think of a server as a **listening program**. That's it.

Your server (`src/index.ts:8`) does this:

```typescript
const server = app.listen(ENV.PORT, () => {
  logger.info(`Server running on port ${ENV.PORT}`);
});
```

Translation: "Hey computer, listen on port 3000 (or whatever ENV.PORT is). When someone sends a request there, wake me up."

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR SERVER                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   1. Starts listening on a port (e.g., 3000)           │
│   2. Waits... and waits... and waits                    │
│   3. Request arrives! → Express handles it              │
│   4. Sends response back                                │
│   5. Goes back to waiting                               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

A server is just a **loop**: wait for request → process it → send response → wait again.

### What is HTTP?

HTTP is the **language** browsers and servers use to talk. It's text-based.

**An HTTP Request looks like:**

```http
GET /api/v1/maintenance-requests?page=1 HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**An HTTP Response looks like:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "requests": [...],
  "pagination": {...}
}
```

That's it. HTTP is just formatted text with:
- **Method** (GET, POST, PUT, DELETE)
- **Path** (`/api/v1/maintenance-requests`)
- **Headers** (metadata like auth tokens)
- **Body** (JSON data)

### HTTP Methods: The Verbs of HTTP

Each method means something different:

| Method | Meaning | Example in your app |
|--------|---------|-------------------|
| **GET** | Fetch data | Get all requests |
| **POST** | Create something | Create new request |
| **PUT** | Replace something | Update entire request |
| **PATCH** | Modify something | Update request status |
| **DELETE** | Remove something | Delete a request |

The method tells the server **what you want to do**. The path tells it **what resource** you're acting on.

### Express Routing: Matching URLs to Code

Express is the **traffic cop** of your app. When a request arrives, Express looks at:
1. The **HTTP method** (GET, POST, etc.)
2. The **URL path** (`/api/v1/maintenance-requests`)

And it decides: "Which function should handle this?"

In your `src/app.ts:112`, you have:

```typescript
app.use("/api/v1/maintenance-requests", requestRoutes);
```

Translation: "Any request starting with `/api/v1/maintenance-requests`? Send it to the `requestRoutes` router."

Then in `src/routes/request.routes.ts:531`:

```typescript
router.get("/", requestController.getAll);
```

Translation: "If it's a **GET** request to just `/`, call the `getAll` function."

**Combined:** `GET /api/v1/maintenance-requests` → `requestController.getAll`

This is **routing** - connecting URLs to the code that handles them.

### The Complete Request Journey

Here's the full journey of a `GET /api/v1/maintenance-requests` request:

```
┌─────────────┐
│   Browser   │  User clicks "View Requests"
└──────┬──────┘
       │
       │ 1. HTTP GET request created
       ▼
┌─────────────────────────────────────────────────────────┐
│                    THE INTERNET                         │
└──────┬──────────────────────────────────────────────────┘
       │
       │ 2. Request arrives at your server (port 3000)
       ▼
┌─────────────────────────────────────────────────────────┐
│  EXPRESS APP (src/app.ts)                               │
│  ✓ Security headers applied                             │
│  ✓ CORS check                                           │
│  ✓ Body parsing (JSON → object)                         │
│  ✓ Logging middleware                                   │
└──────┬──────────────────────────────────────────────────┘
       │
       │ 3. Route matching: /api/v1/maintenance-requests
       ▼
┌─────────────────────────────────────────────────────────┐
│  REQUEST ROUTER (src/routes/request.routes.ts:531)      │
│  ✓ Auth middleware checks JWT token                     │
│  ✓ Validation middleware checks query params            │
│  ✓ Route matched: router.get("/", ...)                  │
└──────┬──────────────────────────────────────────────────┘
       │
       │ 4. Controller function called
       ▼
┌─────────────────────────────────────────────────────────┐
│  CONTROLLER (src/controllers/request.controller.ts:44)  │
│  ✓ Extracts filters from query params                   │
│  ✓ Calls service layer                                  │
└──────┬──────────────────────────────────────────────────┘
       │
       │ 5. Database query
       ▼
┌─────────────────────────────────────────────────────────┐
│  SERVICE (src/services/request.service.ts)             │
│  ✓ Builds Prisma query                                  │
│  ✓ Fetches from MySQL database                          │
└──────┬──────────────────────────────────────────────────┘
       │
       │ 6. Data returns back up the chain
       ▼
┌─────────────────────────────────────────────────────────┐
│  RESPONSE (HTTP 200 OK)                                 │
│  ✓ res.json({ requests: [...], pagination: {...} })    │
└──────┬──────────────────────────────────────────────────┘
       │
       │ 7. Response sent back to browser
       ▼
┌─────────────┐
│   Browser   │  JSON received, parsed, displayed
└─────────────┘
```

Every request goes through this pipeline. Understanding this means you can debug anywhere in the chain.

## Examples from Codebase

### Example 1: Getting All Requests (GET)

**Location:** `src/routes/request.routes.ts:531-536`

```typescript
router.get(
  "/",
  validateRequest(getRequestsQuerySchema),
  cache({ duration: 60 }),
  requestController.getAll
);
```

**What happens:**

1. **Client sends:** `GET /api/v1/maintenance-requests?page=1&limit=10`
2. **Express matches:** This route because it's a GET request to `/`
3. **Middleware runs in order:**
   - `validateRequest` checks that `page` and `limit` are valid numbers
   - `cache` checks if we have a cached response (saves database hit!)
   - `requestController.getAll` is called if no cache hit
4. **Controller responds:** Returns `{ requests: [...], pagination: {...} }`
5. **HTTP Response sent:** `200 OK` with JSON body

**Why this matters:** Every request goes through middleware BEFORE your controller. Order matters!

---

### Example 2: Creating a Request (POST)

**Location:** `src/routes/request.routes.ts:320-324`

```typescript
router.post(
  "/",
  validateRequest(createRequestSchema),
  requestController.create
);
```

**What happens:**

1. **Client sends:** `POST /api/v1/maintenance-requests` with JSON body:
   ```json
   {
     "title": "Fix AC",
     "description": "Not working in Room 201",
     "categoryId": 3,
     "location": "Building A"
   }
   ```
2. **Express matches:** This route because it's a POST request
3. **Middleware runs:**
   - `validateRequest` checks the body has all required fields
   - If validation fails, returns `400 Bad Request` immediately
   - If valid, `requestController.create` is called
4. **Controller creates:** Saves to database via service
5. **HTTP Response sent:** `201 Created` with the new request object

**Key difference:** POST includes a **body** with data. GET doesn't.

---

### Example 3: Path Parameters (GET by ID)

**Location:** `src/routes/request.routes.ts:567-572`

```typescript
router.get(
  "/:id",
  validateRequest(getRequestByIdSchema),
  cache({ duration: 30 }),
  requestController.getById
);
```

**What happens:**

1. **Client sends:** `GET /api/v1/maintenance-requests/abc-123-def`
2. **Express matches:** The `/:id` part captures `abc-123-def`
3. **Available in controller:** `req.params.id` equals `"abc-123-def"`
4. **Controller uses:** Queries database for that specific ID

**Path parameters vs query params:**
- Path: `/api/v1/maintenance-requests/123` → `req.params.id`
- Query: `/api/v1/maintenance-requests?page=1` → `req.query.page`

---

### Example 4: The Server Entry Point

**Location:** `src/index.ts:8-10`

```typescript
const server = app.listen(ENV.PORT, () => {
  logger.info(`Server running on port ${ENV.PORT} in ${ENV.NODE_ENV} mode`);
});
```

**This is where it all starts:**

1. Node.js runs this file
2. `app.listen()` tells Express to start listening
3. Server sits and **waits** for requests
4. When a request arrives, the whole journey above happens

**Without this line, your app does nothing.** It's the "on switch" for your server.

## Try It Yourself

Here's a practical exercise to cement your understanding:

**Add a custom health check endpoint**

1. Open `src/app.ts`
2. After the existing health check route (around line 99), add a new one:

```typescript
// Add this after the existing health check
app.get("/health/detailed", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: ENV.NODE_ENV,
    method: req.method,  // What HTTP method was used?
    path: req.path      // What URL was requested?
  });
});
```

3. Start your server: `npm run dev`
4. Test it in your browser or with curl:
   ```bash
   curl http://localhost:3000/health/detailed
   ```

**What you'll learn:**
- How Express routes are defined
- How `req` (request) and `res` (response) objects work
- How to send JSON responses
- How to access request information (method, path)

**Bonus:** Try changing the method to `app.post("/health/detailed", ...)` and see what happens when you visit it in a browser. (Hint: Browsers make GET requests by default!)

## Summary

**The mental model you now have:**

* A **server** is just a program that listens on a port and responds to requests
* **HTTP** is the language - requests ask for something, responses return data
* **Express** is a framework that routes URLs to your handler functions
* The **request journey** flows through: internet → Express → middleware → controller → service → database → response
* **Routing** connects HTTP methods + paths to specific code functions

**Key distinctions:**
- `req.params` = path variables (`/users/:id` → `req.params.id`)
- `req.query` = URL query params (`/users?page=1` → `req.query.page`)
- `req.body` = JSON payload (POST/PUT requests)

**Common pitfalls:**
- Forgetting `res.send()` or `res.json()` - client waits forever!
- Mixing up `req.params` and `req.query`
- Not understanding middleware order (validation → cache → controller, not the reverse)

You now understand the foundation. Every backend framework - Express, Fastify, NestJS - builds on these same concepts. You're not just copying code anymore; you understand what's happening under the hood.

---

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

### Quiz - 28-12-2025

**Q1: What happens first on the browser side before any HTTP request is created?**
- **Answer given:** B) Browser creates an HTTP GET request object
- **Correct answer:** A) Browser creates a TCP connection to your server
- **Explanation:** HTTP runs ON TOP of TCP. The browser must first establish a TCP connection (3-way handshake) before sending any HTTP. TCP is the foundation.

**Q2: What does Express do when it sees `app.use("/api/v1/maintenance-requests", requestRoutes)`?**
- **Answer given:** A) It immediately calls the router handler
- **Correct answer:** B) It checks if there's middleware defined BEFORE this line
- **Explanation:** Express middleware runs in order. All middleware defined before this line runs first (CORS, body parsing, logging, etc.) and must call `next()` for the router to be reached.

**Q3: What value does `req.params.id` contain for route `/:id` and URL `/abc-123`?**
- **Answer given:** C) `"/:id"`
- **Correct answer:** A) `"abc-123"`
- **Explanation:** `/:id` is a parameter placeholder/pattern. Express extracts the actual value from that position in the URL and stores it in `req.params.id`.

**Q4: What's the difference between `req.params` and `req.query`?**
- **Answer given:** B) `req.params` comes from the URL path, `req.query` comes from the `?key=value` part
- **Correct answer:** ✅ B
- **Explanation:** Exactly right! `req.params` = path variables (`/users/:id`), `req.query` = query string (`?page=1`).

**Q5: What happens after `app.listen()` executes?**
- **Answer given:** B) It enters a loop, waiting for requests indefinitely
- **Correct answer:** ✅ B
- **Explanation:** Correct! The server enters an event loop and continuously waits for incoming requests.

**Score:** 2/5 (40%)
**Understanding Score:** 4/10

**Areas to review:**
- TCP/IP networking stack and how HTTP sits on top
- Middleware execution order and the `next()` function
- Route parameter extraction (`/:pattern` vs actual value)

**Next quiz recommended:** 2 days (30-12-2025) to reinforce these concepts.