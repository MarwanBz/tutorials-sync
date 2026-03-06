# Axios vs Fetch: The API Integration Decision Guide

> A practical guide to choosing between Axios and Fetch API for HTTP requests in React/Next.js applications. Real-world examples from basma-mobile and app-frontend projects.

---
Type: post
Date: 2026-02-23
Reading time: 10 min read
Tags: HTTP, Axios, Fetch API, API Design, Interceptors, TanStack Query, Authentication, Error Handling
---

# Axios vs Fetch: The API Integration Decision Guide

You've built a React app. It works great. Now you need to fetch data from an API. Do you reach for the native `fetch()` API or install Axios?

This isn't a religious debate—it's a practical decision with real tradeoffs. I've made this decision multiple times across different projects, and I want to share what I've learned.

In this tutorial, we'll look at real code from the basma projects and explore when each approach makes sense.

---

## The Problem: What Are We Solving?

Before choosing tools, understand what you actually need:

1. **Data fetching** - GET requests to retrieve data
2. **Mutations** - POST, PATCH, DELETE to modify data
3. **Authentication** - Adding tokens to requests
4. **Error handling** - Gracefully dealing with failures
5. **Request/response transformation** - Modifying data en route
6. **Cancellation** - Stopping requests you no longer need
7. **Interceptors** - Global logic for all requests
8. **Token refresh** - Automatic auth token renewal

The complexity of your needs determines the right tool.

---

## Quick Comparison

| Feature | Fetch | Axios |
|---------|-------|-------|
| **Bundle size** | 0 KB (built-in) | ~13 KB minified |
| **Browser support** | All modern browsers (needs polyfill for older) | IE11+ |
| **Request cancellation** | AbortController | built-in CancelToken |
| **Interceptors** | Manual wrapper required | Built-in |
| **Automatic JSON** | No (need `.json()`) | Yes |
| **Request timeout** | AbortController pattern | Built-in `timeout` config |
| **Response transformation** | Manual | Built-in |
| **Token refresh logic** | You write it yourself | You write it yourself |
| **Progress monitoring** | Limited | Built-in upload/download |
| **Learning curve** | Low (promises) | Low (promises) |

**The key insight:** Both are wrappers around HTTP requests. Axios gives you more batteries-included features. Fetch gives you zero dependencies. The decision hinges on whether those "batteries" save you meaningful development time.

---

## Deep Dive: The Fetch API

Fetch is built into modern browsers. It's promise-based and straightforward.

### Basic Fetch Usage

```typescript
// Simple GET request
const response = await fetch('https://api.example.com/users');
if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}
const data = await response.json();
```

Notice what you have to do manually:
1. Check `response.ok` - fetch doesn't reject on HTTP errors
2. Call `.json()` - response body is a readable stream
3. Handle errors yourself

### Fetch with Authentication

From your app-frontend project (`/home/marwan/app-frontend/app/api/tasks.ts`):

```typescript
const response = await fetch(`${API_BASE_URL}/tasks`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify(taskData),
});

const text = await response.text();
if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}. Details: ${text}`);
}

const data = JSON.parse(text);
```

Key patterns here:
- Manual `Bearer` token construction
- Manual `JSON.stringify()` for body
- Manual response parsing
- Manual error handling

### Fetch Interceptors (You Build Them)

Fetch has no built-in interceptors. You need to create a wrapper:

```typescript
// Example of what you'd need to build
const fetchWithAuth = async (url: string, options = {}) => {
  const token = await getToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Handle token refresh
    const newToken = await refreshToken();
    // Retry request
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${newToken}`,
      },
    });
  }

  return response;
};
```

This is what Axios gives you for free with interceptors.

### When Fetch Shines

1. **Simple, infrequent requests** - One-off API calls
2. **Server-side code** - Next.js server actions, edge functions
3. **Bundle size matters** - Adding 13 KB for Axios is non-trivial
4. **You want control** - No magic, just plain HTTP

---

## Deep Dive: Axios

Axios is a library that simplifies HTTP requests. It's what you chose for basma-mobile, and here's why.

### Basic Axios Usage

```typescript
const response = await axios.get('https://api.example.com/users');
const data = response.data; // Already parsed!
```

Compare to fetch:
- No `.json()` call
- No `response.ok` check (4xx/5xx throw automatically)
- Cleaner, more declarative

### Axios Interceptors: The Killer Feature

From your basma-mobile client (`/home/marwan/basma-app/basma-mobile/api/client.ts`):

```typescript
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: AppConstants.api.timeout,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - runs before every request
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const tokens = await getTokens();

    // Proactive token refresh
    if (tokens.accessToken) {
      if (isTokenExpired(tokens.accessToken, 300)) {
        console.log("Access token expiring soon, refreshing...");

        if (tokens.refreshToken) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            const newTokens = await getTokens();
            config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            return config;
          }
        }
      } else {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
    }
    return config;
  }
);

// Response interceptor - runs after every response
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 - attempt refresh once
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const tokens = await getTokens();
        if (tokens.accessToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return apiClient(originalRequest); // Retry original request
      }

      await clearTokens();
    }

    return Promise.reject(error);
  }
);
```

This is **powerful**. With one axios instance:
- Every request gets auth automatically
- Tokens refresh proactively before expiring
- Failed 401s trigger refresh and retry
- All in one place, DRY

To do this with fetch, you'd build and maintain your own wrapper library.

### Automatic JSON and Error Handling

```typescript
// Axios throws on 4xx/5xx automatically
try {
  const response = await apiClient.post('/users', userData);
  // response.data is already parsed
} catch (error) {
  if (axios.isAxiosError(error)) {
    // error.response?.status - HTTP status
    // error.response?.data - Parsed error body
  }
}
```

### Request Timeout (Built-in)

```typescript
const response = await apiClient.get('/slow-endpoint', {
  timeout: 5000, // 5 seconds
});
```

With fetch, you need AbortController gymnastics.

### When Axios Shines

1. **Complex auth flows** - Token refresh, interceptors
2. **Many API calls** - DRY up common logic
3. **Request/response transformation** - Modify data globally
4. **Upload/download progress** - Built-in support
5. **Older browser support** - IE11 included
6. **TypeScript integration** - Strong typing for responses

---

## The "Convince Me" Section

Let's address the tradeoffs honestly, using decisions from your actual codebase.

### Why Axios for basma-mobile?

Looking at `/home/marwan/basma-app/basma-mobile/api/client.ts`:

**You needed:**
1. JWT token expiration checking before every request
2. Proactive token refresh (5 min buffer)
3. Automatic 401 handling with retry
4. AsyncStorage integration (React Native)
5. Request timeout configuration

**Axios delivered:**
- Interceptors for auth logic in one place
- Request retry mechanism
- Clean TypeScript types
- Consistent error handling

**Could fetch have worked?** Yes, but you'd have built a mini-library. The interceptors alone would be 100+ lines of code. With Axios, it's declarative and maintainable.

**Bundle size concern?** Mobile apps are compiled. 13 KB is negligible compared to your React Native bundle.

### Why Fetch (or mixed) for app-frontend?

Looking at `/home/marwan/app-frontend/app/api/`:

You have a **hybrid approach**:

1. **Axios for structured API calls** (`/home/marwan/app-frontend/app/api/index.ts`):
```typescript
const api = axios.create({ baseURL });
export const getProjects = async ({ token, limit, offset, status }) => {
  const res = await api.get("/projects", {
    params: { limit, offset, status },
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};
```

2. **Fetch for direct, simple calls** (`/home/marwan/app-frontend/app/api/profile.ts`):
```typescript
export const getUserEducationsDirectly = async (userId: string) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_API}/educations/user/${userId}`
  );
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
};
```

This hybrid approach is common. Use Axios where you need its features. Use fetch for simple, one-off calls.

---

## Decision Tree

```
Need to make HTTP requests
│
├─ Are you on Node.js < 18?
│  └─ Use Axios (fetch was added in Node 18)
│
├─ Do you need:
│  ├─ Request/response interceptors? ──┐
│  ├─ Automatic token refresh?          │
│  ├─ Request timeout?                  ├── Use Axios
│  ├─ Upload/download progress?         │
│  └─ Transforming requests/responses? ─┘
│
├─ Is bundle size critical?
│  ├─ Yes ── Use Fetch
│  └─ No ── Continue
│
├─ Do you have > 10 API endpoints with shared logic?
│  ├─ Yes ── Use Axios
│  └─ No ── Use Fetch
│
└─ Default: Use Fetch for simplicity, add Axios if needed
```

---

## Integration with TanStack Query

**Important:** TanStack Query works with ANY fetch function. You don't need Axios to use React Query.

From your admin dashboard (`/home/marwan/basma-app/basma-admin-dashboard/src/hooks/useUsers.ts`):

```typescript
// Axios + TanStack Query
export function useUsers(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.list(params),
    queryFn: () => getUsers(params), // This uses Axios under the hood
    enabled: params !== undefined,
    staleTime: 1000 * 60 * 5,
  });
}
```

With fetch, it's identical from the hook perspective:

```typescript
// Fetch + TanStack Query (what you'd write)
export function useUsers(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: USER_QUERY_KEYS.list(params),
    queryFn: () => fetchUsers(params), // This uses fetch
    enabled: params !== undefined,
    staleTime: 1000 * 60 * 5,
  });
}

// The fetch function
async function fetchUsers(params: { page: number, limit: number }) {
  const searchParams = new URLSearchParams();
  searchParams.append('page', params.page.toString());
  searchParams.append('limit', params.limit.toString());

  const response = await fetch(`/api/users?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}
```

**The lesson:** TanStack Query abstracts the data fetching layer. Your choice of Axios vs fetch doesn't affect your React Query hooks.

---

## Common Pitfalls

### 1. Forgetting to Check response.ok with Fetch

```typescript
// ❌ WRONG - 404 doesn't throw
const data = await fetch('/api/users').then(r => r.json());

// ✅ RIGHT
const response = await fetch('/api/users');
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();
```

### 2. Not Handling 401s Globally

With Axios, use response interceptors. With fetch, build a wrapper function. Don't handle 401s in every single call.

### 3. Double JSON Parsing

```typescript
// ❌ WRONG - Axios already parses
const response = await axios.get('/api/users');
const data = await response.data.json(); // Error!

// ✅ RIGHT
const response = await axios.get('/api/users');
const data = response.data; // Already parsed
```

### 4. Missing Content-Type Header

Both fetch and Axios need this for POST requests:

```typescript
headers: {
  'Content-Type': 'application/json',
}
```

Axios sets this automatically for objects. Fetch does not.

### 5. Forgetting AbortController with Fetch

```typescript
// ❌ WRONG - Cannot cancel
const data = await fetch('/api/slow');

// ✅ RIGHT
const controller = new AbortController();
fetch('/api/slow', { signal: controller.signal });
// Later: controller.abort()
```

---

## Real-World Recommendation

Based on your projects and modern best practices:

### For New Projects:

1. **Start with fetch** if:
   - Simple CRUD app
   - Next.js with server components
   - Bundle size is a concern
   - You're using TanStack Query (it handles most complexity)

2. **Use Axios** if:
   - Complex authentication (token refresh, interceptors)
   - Many API endpoints with shared logic
   - You need request cancellation frequently
   - Mobile app (React Native) - your basma-mobile use case

### For Existing Projects:

Don't migrate unless you have a compelling reason. Both work fine.

---

## Summary

| Decision | Why |
|----------|-----|
| **Fetch** | Zero dependencies, built-in, simple cases |
| **Axios** | Interceptors, complex auth, many endpoints |
| **TanStack Query** | Works with both, handles caching/state |
| **Mobile (React Native)** | Axios - interceptors worth the bundle cost |

The right tool depends on your specific needs. There's no shame in using Axios when it saves you from building and maintaining your own HTTP wrapper. And there's no need for Axios if fetch covers your use cases.

**The senior insight:** Understand the tradeoffs, choose pragmatically, and don't be afraid to use both in the same codebase when appropriate.

---

## Code References

- Axios with interceptors: `/home/marwan/basma-app/basma-mobile/api/client.ts`
- Admin dashboard Axios: `/home/marwan/basma-app/basma-admin-dashboard/src/apis/client.ts`
- Fetch examples: `/home/marwan/app-frontend/app/api/tasks.ts`
- TanStack Query integration: `/home/marwan/basma-app/basma-admin-dashboard/src/hooks/useUsers.ts`

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]