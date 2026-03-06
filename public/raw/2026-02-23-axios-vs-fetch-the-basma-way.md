# Axios vs Fetch: The Basma Way

> A deep dive comparing Axios vs Fetch API using real examples from your Basma mobile and dashboard projects - understanding when each pays for itself

---
Type: post
Date: 2026-02-23
Reading time: 11 min read
Tags: HTTP, Fetch API, Axios, Interceptors, JWT, TanStack Query
---

# Axios vs Fetch: The Basma Way

You've used both Axios and fetch in your projects. But do you know *why* you chose each? Can you explain the tradeoffs to another developer?

This isn't a tutorial about syntax—it's a code review of your actual decisions. We'll look at what you built in `basma-mobile` and `basma-admin-dashboard`, understand why Axios was the right choice there, and learn when fetch is enough.

## Part 1: Your Current Axios Setup - Code Review

Let's review what you actually built. Open `basma-mobile/api/client.ts:77-134`:

```typescript
// ✅ Request interceptor - proactive refresh
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const tokens = await getTokens();

      // Handle expiration proactively
      if (tokens.accessToken) {
        if (isTokenExpired(tokens.accessToken, 300)) {  // 5 min buffer
          console.log("Access token expired or expiring soon, attempting proactive refresh");

          if (tokens.refreshToken) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
              const newTokens = await getTokens();
              if (newTokens.accessToken) {
                config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
                return config;
              }
            }
          }
        } else {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
      }
    } catch (error) {
      console.error("Error handling request interceptor:", error);
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ✅ Response interceptor - 401 handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const tokens = await getTokens();
        if (tokens.accessToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return apiClient(originalRequest);  // Retry
      }

      await clearTokens();
    }

    return Promise.reject(error);
  }
);
```

### What's Working Well

| Pattern | Why It's Good |
|---------|---------------|
| **Proactive refresh** (5 min buffer) | Users never see expired tokens - refresh happens BEFORE expiry |
| **Request interceptor** | Auth logic is DRY - every request gets a token automatically |
| **Response interceptor** | 401s are handled globally - no per-request error handling needed |
| **Retry flag (`_retry`)** | Prevents infinite loops if refresh also fails |
| **Fallback behavior** | If refresh fails, clear tokens and let user re-auth |

### What Could Be Improved

```typescript
// ⚠️ Issue: Silent failures in the interceptor
try {
  const tokens = await getTokens();
  // ...
} catch (error) {
  console.error("Error handling request interceptor:", error);
}
// If getTokens() throws, we proceed without auth - request will 401
// Better: Let the error propagate or handle explicitly
```

```typescript
// ⚠️ Issue: Race condition possible
if (isTokenExpired(tokens.accessToken, 300)) {
  const refreshed = await refreshAccessToken();
  // If 3 requests happen simultaneously, all trigger refresh
}
// Better: Implement a refresh promise queue
```

---

## Part 2: What This Would Look Like with Fetch

You chose Axios. But what if you had used fetch? Let's rewrite the same functionality:

```typescript
// ❌ This is what you'd have to build manually

// First, create a fetch wrapper (Axios gives you this for free)
const apiClient = {
  async get<T>(url: string, config?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${url}`, {
      ...config,
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  async post<T>(url: string, data?: any, config?: RequestInit): Promise<T> {
    return this.get<T>(url, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ... put, patch, delete, etc.
};

// Now add the interceptor logic (Axios gives you this for free)
let refreshingPromise: Promise<boolean> | null = null;

async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get tokens
  const tokens = await getTokens();

  // Check expiry proactively
  if (tokens.accessToken && isTokenExpired(tokens.accessToken, 300)) {
    // Prevent multiple simultaneous refreshes
    if (!refreshingPromise) {
      refreshingPromise = refreshAccessTokenForFetch().finally(() => {
        refreshingPromise = null;
      });
    }
    await refreshingPromise;
    const newTokens = await getTokens();
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${newTokens.accessToken}`,
    };
  } else if (tokens.accessToken) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${tokens.accessToken}`,
    };
  }

  let response = await fetch(`${BASE_URL}${url}`, options);

  // Handle 401 - retry once
  if (response.status === 401 && !options._retry) {
    const refreshed = await refreshAccessTokenForFetch();
    if (refreshed) {
      const newTokens = await getTokens();
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${newTokens.accessToken}`,
      };
      options._retry = true;
      response = await fetch(`${BASE_URL}${url}`, options);
    } else {
      await clearTokens();
    }
  }

  return response;
}

// You'd need to call fetchWithAuth everywhere instead of fetch
```

### Line Count Comparison

| Implementation | Lines of Code | What You Get |
|----------------|---------------|--------------|
| **Axios** | ~60 lines | Interceptors, retry, timeout, JSON parsing |
| **Fetch** | ~150+ lines | Manual implementation of the above |

### Markers: Where Fetch Falls Short

```typescript
// ❌ Fetch doesn't throw on HTTP errors
const response = await fetch('/api/users');
// response.ok might be false, but no error thrown

// ✅ Axios throws automatically
try {
  await axios.get('/api/users');
} catch (error) {
  // 4xx and 5xx throw automatically
}
```

```typescript
// ❌ Fetch requires manual JSON parsing
const response = await fetch('/api/users');
if (!response.ok) throw new Error();
const data = await response.json();

// ✅ Axios parses automatically
const { data } = await axios.get('/api/users');
```

```typescript
// ❌ Fetch timeout requires AbortController
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);
try {
  const response = await fetch('/api/slow', { signal: controller.signal });
} finally {
  clearTimeout(timeoutId);
}

// ✅ Axios has built-in timeout
await axios.get('/api/slow', { timeout: 5000 });
```

---

## Part 3: The "Convince Me" Analysis

Let's be honest about the tradeoffs. You're not installing Axios for fun—you're making a calculated decision.

### Bundle Size Breakdown

| Library | Size (minified + gzipped) |
|---------|--------------------------|
| **Axios** | ~13 KB |
| **Fetch** | 0 KB (built-in) |
| **TanStack Query** | ~13 KB |
| **React** | ~45 KB |

**Reality check:** If you're already using React (45 KB) + TanStack Query (13 KB), adding Axios (13 KB) is a 17% increase. Not trivial, but not catastrophic for most apps.

### Development Time Tradeoff

| Task | With Axios | With Fetch |
|------|-----------|------------|
| Simple GET request | 1 line | 3 lines |
| Auth header per request | Automatic (interceptor) | Manual per call or custom wrapper |
| Token refresh on 401 | 20 lines (interceptor) | 50+ lines (custom wrapper) |
| Request timeout | 1 config option | AbortController gymnastics |
| Upload progress | Built-in callback | Manual XHR |

**The math:** If you spend 2 hours building and maintaining a fetch wrapper, was that worth saving 13 KB?

### When Each Approach Pays for Itself

```
Use Fetch when:
├─ You have < 5 API endpoints
├─ No complex auth (simple Bearer token)
├─ Server Actions or Edge Functions
└─ Bundle size is critical (landing pages, widgets)

Use Axios when:
├─ JWT with token refresh ← YOUR CASE
├─ 10+ API endpoints with shared logic ← YOUR CASE
├─ Request/response transformation
├─ Upload/download progress tracking
└─ Mobile app (bundle compiled) ← YOUR CASE
```

### Your Specific Case: Why Axios Was Right

Looking at your `basma-mobile` project:

1. **JWT with refresh tokens** - You need proactive refresh and 401 retry
2. **Mobile app** - Bundle is compiled, 13 KB is negligible
3. **~20 API endpoints** - DRY interceptors prevent code duplication
4. **AsyncStorage integration** - Interceptors handle async token retrieval

**Verdict:** Axios pays for itself. The ~150 lines you'd have to write with fetch would need maintenance, testing, and debugging.

---

## Part 4: TanStack Query Integration

You're using TanStack Query in your dashboard. Does it change the equation?

**Key insight:** TanStack Query handles caching, retries, deduplication—but it doesn't do interceptors.

### Your Dashboard Pattern

From `basma-admin-dashboard/src/hooks/useRequests.ts:23-28`:

```typescript
// ✅ Query key factory (hierarchical for smart invalidation)
export const REQUEST_QUERY_KEYS = {
  all: ["requests"] as const,
  list: (params?: any) => ["requests", params] as const,
  detail: (id: string) => ["request", id] as const,
  comments: (id: string) => ["request-comments", id] as const,
};
```

From `basma-admin-dashboard/src/hooks/useRequests.ts:126-132`:

```typescript
// ✅ Query hook with TanStack Query
export function useRequests(params?: {...}) {
  return useQuery({
    queryKey: REQUEST_QUERY_KEYS.list(params),
    queryFn: () => getRequestsAsync(params),  // ← Uses Axios under the hood
    enabled: params !== undefined && params !== null,
    staleTime: DEFAULT_STALE_TIME,  // 5 minutes
    gcTime: DEFAULT_GC_TIME,
  });
}
```

From `basma-admin-dashboard/src/apis/requests.ts:38-62`:

```typescript
// ✅ Axios at the API layer
export async function getRequests(params?: {...}): Promise<GetRequestsResponse> {
  const searchParams = new URLSearchParams();
  // ... build query string

  const response = await apiClient.get<GetRequestsResponse>(url);
  return response.data;
}
```

### The Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENT LAYER                          │
│  useRequests() → useQuery() → returns { data, isLoading }  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  TANSTACK QUERY LAYER                       │
│  • Caching (staleTime, gcTime)                              │
│  • Deduplication                                            │
│  • Background refetch                                        │
│  • DOES NOT do interceptors                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER (Axios)                        │
│  • Interceptors (auth, refresh)                             │
│  • Request transformation                                   │
│  • Error handling                                           │
│  • Timeout                                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      HTTP LAYER                             │
│  • Actual network requests                                  │
└─────────────────────────────────────────────────────────────┘
```

**The lesson:** TanStack Query and Axios solve different problems. RQ handles *data state*, Axios handles *HTTP concerns*. They complement each other.

---

## Part 5: Decision Framework

Use this flowchart to decide:

```
Need to make HTTP requests
│
├─ Server-side code (Next.js Server Actions, Edge Functions)?
│  └─ YES → Use Fetch (built-in, no dependencies)
│
├─ Simple CRUD app with < 5 endpoints?
│  └─ YES → Use Fetch
│
├─ Do you need:
│  ├─ JWT token refresh with interceptors?
│  ├─ Automatic 401 handling with retry?
│  ├─ Request/response transformation?
│  └─ Upload/download progress?
│  └─ YES (to any) → Use Axios
│
├─ Is this a mobile app (React Native)?
│  └─ YES → Use Axios (bundle size less critical, interceptors valuable)
│
└─ Default: Start with Fetch, add Axios if complexity grows
```

### Checklist: When to Add Axios

Add Axios to your project if you answer YES to 2+ of these:

- [ ] JWT authentication with refresh tokens
- [ ] 10+ API endpoints with shared logic
- [ ] Need automatic 401 handling with retry
- [ ] Request timeout on multiple endpoints
- [ ] File upload/download with progress
- [ ] Mobile app (bundle compiled, not browser-loaded)

---

## Part 6: Common Pitfalls

### Pitfall 1: Not Checking `response.ok` with Fetch

```typescript
// ❌ WRONG - 404 doesn't throw, data is undefined
const data = await fetch('/api/users').then(r => r.json());

// ✅ RIGHT
const response = await fetch('/api/users');
if (!response.ok) {
  throw new Error(`HTTP ${response.status}`);
}
const data = await response.json();
```

### Pitfall 2: Double JSON Parsing with Axios

```typescript
// ❌ WRONG - Axios already parsed it
const response = await apiClient.get('/api/users');
const data = await response.data.json();  // ERROR!

// ✅ RIGHT
const response = await apiClient.get('/api/users');
const data = response.data;  // Already an object
```

### Pitfall 3: Forgetting Content-Type

```typescript
// ❌ WRONG - Server can't parse the body
fetch('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'Marwan' }),
});

// ✅ RIGHT
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Marwan' }),
});

// Axios sets this automatically for object bodies ✅
```

### Pitfall 4: Handling 401s Individually

```typescript
// ❌ WRONG - Every request has to handle 401
async function getUsers() {
  const response = await fetch('/api/users');
  if (response.status === 401) {
    // Handle refresh here
  }
  return response.json();
}

// ✅ RIGHT - Use interceptors (Axios) or a wrapper function (fetch)
```

---

## Summary: The Mental Model

| Decision | Why |
|----------|-----|
| **Fetch** | Zero dependencies, simple cases, server-side |
| **Axios** | Interceptors, JWT refresh, complex auth |
| **TanStack Query** | Works with both, handles caching/state |
| **Mobile (React Native)** | Axios - interceptors worth the bundle cost |

The right tool depends on your specific needs. There's no shame in using Axios when it saves you from building and maintaining your own HTTP wrapper. And there's no need for Axios if fetch covers your use cases.

**Your code proves the pattern:** You used the same Axios interceptor setup in both `basma-mobile` and `basma-admin-dashboard`. The complexity of JWT refresh with 401 retry makes Axios's value clear.

**The senior insight:** Understand the tradeoffs, choose pragmatically, and don't be afraid to use both in the same codebase when appropriate. Use fetch for Server Actions and simple calls. Use Axios for complex auth flows. Let TanStack Query handle the caching regardless of which HTTP client you choose.

---

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]