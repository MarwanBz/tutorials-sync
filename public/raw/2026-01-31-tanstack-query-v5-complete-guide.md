# TanStack Query v5: Complete Guide with Code Review

> Complete TanStack Query v5 guide - from query keys factory to advanced patterns. Code review of basma-mobile with actionable improvements.

---
Type: post
Date: 2026-01-31
Reading time: 14 min read
Tags: TanStack Query v5, Query Keys Factory, Query Options, Optimistic Updates, Prefetching, Infinite Queries
---

# TanStack Query v5: Complete Guide with Code Review

This tutorial reviews your actual `basma-mobile` code and shows you exactly what to improve based on official TanStack Query v5 best practices and community patterns.

## Part 1: Code Review - What You're Doing Wrong

### Current Setup Analysis

**File: `api/query.tsx`**

```typescript
// ❌ ISSUES FOUND

"use client";  // ❌ Not needed for Expo - this is Next.js specific

let queryClientSingleton: QueryClient | null = null;

function getQueryClient(): QueryClient {
  if (!queryClientSingleton) {
    queryClientSingleton = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 30,     // ⚠️ 30s is too short - excessive refetches
          refetchOnWindowFocus: false, // ✅ Good for mobile
          retry: 4,                  // ⚠️ Too aggressive for mobile - drains battery
          // ❌ Missing gcTime (v5 renamed from cacheTime)
        },
        mutations: {
          retry: 0,                  // ✅ Good - don't retry mutations
        },
      },
    });
  }
  return queryClientSingleton;
}
```

### Recommended Setup

```typescript
// ✅ IMPROVED VERSION
// api/query.tsx

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useReactQueryDevTools } from "@dev-plugins/react-query";

// ❌ REMOVE "use client" - not needed for Expo

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // ✅ 5 minutes is better for mobile - reduces network calls
        staleTime: 5 * 60 * 1000,

        // ✅ Keep cached data for 30 minutes (formerly cacheTime)
        gcTime: 30 * 60 * 1000,

        // ✅ Disable window focus refetch for mobile
        refetchOnWindowFocus: false,

        // ✅ Reduced retry - saves battery and data
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors)
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          // Retry up to 2 times for 5xx errors
          return failureCount < 2;
        },

        // ✅ Don't refetch on mount for recently fetched data
        refetchOnMount: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new client
    return makeQueryClient();
  } else {
    // Browser: create once and reuse
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // NOTE: Avoid useState when initializing the QueryClient if you don't
  // have a suspense boundary between this and the code that may
  // suspend because React will throw away the client on the initial
  // render if it suspends and there is no boundary
  const queryClient = getQueryClient();

  useReactQueryDevTools(queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Issues Fixed

| Issue | Before | After | Why |
|-------|--------|-------|-----|
| `"use client"` | Included | Removed | Not needed for Expo (Next.js only) |
| `staleTime` | 30 seconds | 5 minutes | Reduces network calls on mobile |
| `gcTime` | Missing | 30 minutes | Controls cache retention (v5 renamed from `cacheTime`) |
| `retry` | Always 4 times | Smart retry | Saves battery, respects 4xx errors |
| `refetchOnMount` | Default (true) | false | Prevents unnecessary refetches |

---

## Part 2: Query Keys Factory Pattern

### Current Issues

**File: `hooks/useRequests.ts`**

```typescript
// ❌ CURRENT APPROACH - Scattered, inconsistent keys

export function useMyRequests(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ["myRequests", params],  // ⚠️ Flat structure, no hierarchy
    queryFn: () => getMyRequests(params?.page, params?.limit, params?.status),
  });
}

export function useAssignedRequests(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ["assignedRequests", params],  // ⚠️ Separate namespace, no relation
    queryFn: () => getAssignedRequests(params?.page, params?.limit, params?.status),
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ["request", id],  // ⚠️ Inconsistent pattern - singular vs plural
    queryFn: () => getRequestById(id),
    enabled: !!id,
  });
}
```

### The Query Keys Factory Pattern

```typescript
// ✅ NEW FILE: lib/query-keys.ts
// Centralized query key factory for all request-related queries

export const requestKeys = {
  // Root key for all request queries
  all: ['requests'] as const,

  // All lists (any filter)
  lists: () => [...requestKeys.all, 'list'] as const,

  // List with specific filters
  list: (filters: { page?: number; limit?: number; status?: string }) =>
    [...requestKeys.lists(), filters] as const,

  // My requests (customer view)
  my: (filters?: { page?: number; limit?: number; status?: string }) =>
    [...requestKeys.all, 'my', ...(filters ? [filters] : [])] as const,

  // Assigned requests (technician view)
  assigned: (filters?: { page?: number; limit?: number; status?: string }) =>
    [...requestKeys.all, 'assigned', ...(filters ? [filters] : [])] as const,

  // Available requests for self-assignment
  available: (filters?: { page?: number; limit?: number }) =>
    [...requestKeys.all, 'available', ...(filters ? [filters] : [])] as const,

  // Single request detail
  detail: (id: string) => [...requestKeys.all, id] as const,

  // Confirmation status for a request
  confirmationStatus: (id: string) => [...requestKeys.detail(id), 'confirmation'] as const,
} as const;

// ✅ Benefits:
// 1. Type-safe with `as const`
// 2. Hierarchical - easy to invalidate related queries
// 3. Centralized - single source of truth
// 4. Autocomplete-friendly
```

### Usage in Hooks

```typescript
// ✅ UPDATED: hooks/useRequests.ts

import { requestKeys } from "@/lib/query-keys";

export function useMyRequests(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: requestKeys.my(params),  // ✅ Centralized key factory
    queryFn: () => getMyRequests(params?.page, params?.limit, params?.status),
  });
}

export function useAssignedRequests(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: requestKeys.assigned(params),
    queryFn: () => getAssignedRequests(params?.page, params?.limit, params?.status),
  });
}

export function useAvailableRequests(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: requestKeys.available(params),
    queryFn: () => getAvailableRequests(params?.page, params?.limit),
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: requestKeys.detail(id),
    queryFn: () => getRequestById(id),
    enabled: !!id,
  });
}
```

### Invalidation with Query Keys Factory

```typescript
// ✅ Smart invalidation using hierarchical keys

export function useSelfAssignRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => selfAssignRequest(requestId),
    onSuccess: () => {
      // ✅ Invalidate all request-related queries at once
      queryClient.invalidateQueries({
        queryKey: requestKeys.all,  // Invalidates: my, assigned, available, detail
      });
    },
  });
}

// Or be more specific:
export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, status, notes }: { requestId: string; status: RequestStatus; notes?: string }) =>
      updateRequestStatus(requestId, status, notes),
    onSuccess: (_, { requestId }) => {
      // ✅ Invalidate specific request + all lists
      queryClient.invalidateQueries({
        queryKey: requestKeys.detail(requestId),
      });
      queryClient.invalidateQueries({
        queryKey: requestKeys.lists(),  // All list queries
      });
    },
  });
}
```

---

## Part 3: Query Options Factory Pattern

Query options combine query keys and functions into reusable, type-safe units.

```typescript
// ✅ NEW FILE: lib/query-options.ts

import { queryOptions } from "@tanstack/react-query";
import { getMyRequests, getAssignedRequests, getAvailableRequests, getRequestById } from "@/api/requests";
import { requestKeys } from "./query-keys";

// Reusable query options
export const requestQueryOptions = {
  // My requests (customer)
  my: (params?: { page?: number; limit?: number; status?: string }) =>
    queryOptions({
      queryKey: requestKeys.my(params),
      queryFn: () => getMyRequests(params?.page, params?.limit, params?.status),
      staleTime: 2 * 60 * 1000, // 2 minutes - override default for this query
    }),

  // Assigned requests (technician)
  assigned: (params?: { page?: number; limit?: number; status?: string }) =>
    queryOptions({
      queryKey: requestKeys.assigned(params),
      queryFn: () => getAssignedRequests(params?.page, params?.limit, params?.status),
    }),

  // Available requests
  available: (params?: { page?: number; limit?: number }) =>
    queryOptions({
      queryKey: requestKeys.available(params),
      queryFn: () => getAvailableRequests(params?.page, params?.limit),
      staleTime: 1 * 60 * 1000, // 1 minute - available requests change more often
    }),

  // Single request
  detail: (id: string) =>
    queryOptions({
      queryKey: requestKeys.detail(id),
      queryFn: () => getRequestById(id),
      enabled: !!id,
      staleTime: 10 * 60 * 1000, // 10 minutes - details don't change often
    }),
} as const;

// ✅ Usage - same options work with all hooks:
export function useMyRequestsOptions(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery(requestQueryOptions.my(params));
}

// Also works with:
// - useSuspenseQuery(requestQueryOptions.my(params))
// - prefetchQuery(queryClient, requestQueryOptions.my(params))
// - ensureQueryData(queryClient, requestQueryOptions.my(params))
```

---

## Part 4: Optimistic Updates

Your current mutations don't use optimistic updates. Here's how to add them for instant UI feedback.

### Example: Toggle Request Status

```typescript
// ✅ NEW: hooks/useOptimisticRequestStatus.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateRequestStatus } from "@/api/requests";
import { requestKeys } from "@/lib/query-keys";
import { RequestStatus } from "@/types/request";

export function useOptimisticUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: RequestStatus }) =>
      updateRequestStatus(requestId, status),

    // ✅ Optimistic update - instant UI feedback
    onMutate: async ({ requestId, status }) => {
      // 1. Cancel outgoing refetches to avoid overwriting
      await queryClient.cancelQueries({
        queryKey: requestKeys.detail(requestId),
      });

      // 2. Snapshot previous value for rollback
      const previousRequest = queryClient.getQueryData(
        requestKeys.detail(requestId)
      );

      // 3. Optimistically update to new value
      queryClient.setQueryData(
        requestKeys.detail(requestId),
        (old: any) => ({
          ...old,
          status,
          // Also update timestamps optimistically
          updatedAt: new Date().toISOString(),
        })
      );

      // 4. Return context for rollback
      return { previousRequest };
    },

    // 5. Rollback on error
    onError: (error, variables, context) => {
      queryClient.setQueryData(
        requestKeys.detail(variables.requestId),
        context?.previousRequest
      );
    },

    // 6. Refetch after success or error
    onSettled: (_, __, { requestId }) => {
      queryClient.invalidateQueries({
        queryKey: requestKeys.detail(requestId),
      });
    },
  });
}
```

### Example: Optimistic Add to List

```typescript
// ✅ NEW: hooks/useOptimisticCreateRequest.ts

export function useOptimisticCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRequestData) => createRequest(data),

    onMutate: async (newRequest) => {
      // Cancel list queries
      await queryClient.cancelQueries({
        queryKey: requestKeys.my(),
      });

      // Snapshot
      const previousRequests = queryClient.getQueryData(
        requestKeys.my()
      );

      // Optimistically add to list
      const optimisticRequest: MaintenanceRequest = {
        id: `temp-${Date.now()}`,
        title: newRequest.title,
        description: newRequest.description,
        status: "SUBMITTED",
        priority: newRequest.priority,
        category: "GENERAL",
        location: newRequest.location,
        customerId: "current-user",
        customerName: "You",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData(
        requestKeys.my(),
        (old: any) => ({
          ...old,
          requests: [optimisticRequest, ...(old?.requests || [])],
        })
      );

      return { previousRequests, optimisticRequest };
    },

    onError: (error, variables, context) => {
      queryClient.setQueryData(
        requestKeys.my(),
        context?.previousRequests
      );
    },

    onSuccess: (data, variables, context) => {
      // Replace optimistic item with real data
      queryClient.setQueryData(
        requestKeys.my(),
        (old: any) => ({
          ...old,
          requests: old?.requests?.map((req: MaintenanceRequest) =>
            req.id === context?.optimisticRequest.id ? data : req
          ),
        })
      );
    },
  });
}
```

---

## Part 5: Prefetching Strategies

Prefetching data before the user needs it creates a perceived performance boost.

### Hover/Intent Prefetching

```typescript
// ✅ Request Card with prefetch on hover

import { useQueryClient } from "@tanstack/react-query";
import { requestQueryOptions } from "@/lib/query-options";

export function RequestCard({ request }: { request: MaintenanceRequest }) {
  const queryClient = useQueryClient();

  const prefetchRequest = () => {
    // Prefetch details on hover/focus
    queryClient.prefetchQuery({
      ...requestQueryOptions.detail(request.id),
      staleTime: 30 * 1000, // Keep fresh for 30 seconds
    });
  };

  return (
    <Pressable
      onPress={() => router.push(`/requests/${request.id}`)}
      // Prefetch on hover (desktop) or focus (keyboard navigation)
      onMouseEnter={prefetchRequest}
      onFocus={prefetchRequest}
    >
      <Text>{request.title}</Text>
    </Pressable>
  );
}
```

### Route-Based Prefetching

```typescript
// ✅ Prefetch when user navigates to a screen

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function RequestsListScreen() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch first page of details for visible items
    const prefetchNextPage = async () => {
      const data = queryClient.getQueryData(requestKeys.my({ page: 1 }));
      if (data?.requests) {
        // Prefetch details for first 3 requests
        data.requests.slice(0, 3).forEach((request) => {
          queryClient.prefetchQuery({
            ...requestQueryOptions.detail(request.id),
          });
        });
      }
    };

    prefetchNextPage();
  }, [queryClient]);

  // ... rest of component
}
```

### Link Prefetching Pattern

```typescript
// ✅ Reusable prefetching link component

export function PrefetchLink<T>({
  id,
  queryOptions,
  children,
  href,
}: {
  id: string;
  queryOptions: any;
  children: React.ReactNode;
  href: string;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const handlePressIn = () => {
    queryClient.prefetchQuery(queryOptions(id));
  };

  return (
    <Pressable onPressIn={handlePressIn} onPress={() => router.push(href)}>
      {children}
    </Pressable>
  );
}

// Usage:
<PrefetchLink
  id={request.id}
  queryOptions={requestQueryOptions.detail}
  href={`/requests/${request.id}`}
>
  <RequestCard request={request} />
</PrefetchLink>
```

---

## Part 6: Infinite Queries for Pagination

Your current pagination uses manual `page` params. Infinite queries are better for scroll-based pagination.

```typescript
// ✅ NEW: hooks/useInfiniteMyRequests.ts

import { useInfiniteQuery } from "@tanstack/react-query";
import { getMyRequests } from "@/api/requests";
import { requestKeys } from "@/lib/query-keys";

interface MyRequestsParams {
  limit?: number;
  status?: string;
}

export function useInfiniteMyRequests(params?: MyRequestsParams) {
  return useInfiniteQuery({
    queryKey: requestKeys.my({ ...params, infinite: true }),

    queryFn: async ({ pageParam = 1 }) => {
      const response = await getMyRequests(
        pageParam,
        params?.limit || 20,
        params?.status
      );
      return response;
    },

    // ✅ Required in v5
    initialPageParam: 1,

    // ✅ Determine if there's a next page
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.pagination.page < lastPage.pagination.pages) {
        return lastPage.pagination.page + 1;
      }
      return undefined; // No more pages
    },
  });
}

// ✅ Usage in component:
export function MyRequestsList() {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMyRequests({ status: "IN_PROGRESS" });

  const requests = data?.pages.flatMap((page) => page.requests) || [];

  return (
    <FlatList
      data={requests}
      renderItem={({ item }) => <RequestCard request={item} />}
      keyExtractor={(item) => item.id}
      onEndReached={() => {
        if (hasNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={() =>
        isFetchingNextPage ? <ActivityIndicator /> : null
      }
    />
  );
}
```

---

## Part 7: Parallel Queries with useQueries

Your code may fetch multiple things sequentially. Use `useQueries` for parallel fetching.

```typescript
// ✅ Example: Fetch dashboard data in parallel

import { useQueries } from "@tanstack/react-query";

export function useDashboardData() {
  const user = useAuth().user;

  const results = useQueries({
    queries: [
      {
        queryKey: ["requests", "my", { page: 1, limit: 5, status: "IN_PROGRESS" }],
        queryFn: () => getMyRequests(1, 5, "IN_PROGRESS"),
        enabled: !!user,
      },
      {
        queryKey: ["requests", "assigned", { page: 1, limit: 5 }],
        queryFn: () => getAssignedRequests(1, 5),
        enabled: !!user && user.role === "TECHNICIAN",
      },
      {
        queryKey: ["notifications", "unread"],
        queryFn: () => getUnreadNotifications(),
        enabled: !!user,
      },
    ],

    // ✅ Combine results (v5 feature)
    combine: (results) => ({
      myRequests: results[0].data,
      assignedRequests: results[1].data,
      notifications: results[2].data,
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
    }),
  });

  return results;
}
```

---

## Part 8: Mutation Keys for Global Tracking

Add mutation keys to enable `useMutationState` for global loading indicators.

```typescript
// ✅ UPDATED: Add mutation keys

export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    // ✅ Add mutation key for tracking
    mutationKey: ["requests", "updateStatus"],

    mutationFn: ({ requestId, status, notes }: { requestId: string; status: RequestStatus; notes?: string }) =>
      updateRequestStatus(requestId, status, notes),

    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: requestKeys.detail(requestId) });
    },
  });
}

// ✅ Global loading indicator using useMutationState
export function GlobalMutationIndicator() {
  const pendingCount = useMutationState({
    filters: { status: "pending" },
    select: (mutation) => mutation.state.variables,
  }).length;

  if (pendingCount === 0) return null;

  return (
    <View style={styles.indicator}>
      <ActivityIndicator size="small" />
      <Text>Saving {pendingCount} {pendingCount === 1 ? "change" : "changes"}...</Text>
    </View>
  );
}
```

---

## Part 9: Placeholder Data for Smooth UX

Use `placeholderData` to show previous data while fetching new.

```typescript
// ✅ Show previous data while paginating
export function useMyRequestsWithPlaceholder(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: requestKeys.my(params),
    queryFn: () => getMyRequests(params?.page, params?.limit, params?.status),

    // ✅ Keep previous data visible while fetching next page
    placeholderData: (previousData) => previousData,

    // ✅ Or use the helper (v5)
    // placeholderData: keepPreviousData,
  });
}
```

---

## Part 10: Complete Checklist

### Query Client Setup

- [ ] Remove `"use client"` from `api/query.tsx`
- [ ] Set `staleTime: 5 * 60 * 1000` (5 minutes)
- [ ] Set `gcTime: 30 * 60 * 1000` (30 minutes)
- [ ] Implement smart retry (respect 4xx errors)
- [ ] Set `refetchOnMount: false`

### Query Keys Factory

- [ ] Create `lib/query-keys.ts`
- [ ] Define hierarchical key structure
- [ ] Use `as const` for type safety
- [ ] Update all hooks to use the factory

### Query Options

- [ ] Create `lib/query-options.ts`
- [ ] Define reusable query options
- [ ] Override `staleTime` per query as needed

### Mutations

- [ ] Add `mutationKey` to all mutations
- [ ] Add `onError` callbacks
- [ ] Implement optimistic updates where appropriate
- [ ] Use hierarchical invalidation

### Performance

- [ ] Add `placeholderData` for pagination
- [ ] Implement hover/scroll prefetching
- [ ] Use `useQueries` for parallel fetching
- [ ] Consider infinite queries for scroll-based lists

---

## Summary of Changes

| Pattern | Current | Improved |
|---------|---------|----------|
| Query Keys | `["myRequests", params]` | `requestKeys.my(params)` |
| Invalidation | Individual keys | `requestKeys.all` (hierarchical) |
| Retry | Always 4x | Smart (2x max, skip 4xx) |
| Stale Time | 30s | 5 minutes |
| GC Time | Missing | 30 minutes |
| Optimistic Updates | None | Added for key actions |
| Prefetching | None | Hover/route-based |
| Mutation Keys | None | Added for tracking |

---

## Q&A

[Questions will be added here]

## Quiz History

[Quiz sessions will be recorded here]

## Further Reading

- [TanStack Query Official Docs](https://tanstack.com/query/latest)
- [TkDodo: React Query API Design Lessons](https://tkdodo.eu/blog/react-query-api-design-lessons-learned)
- [TkDodo: Practical React Query](https://tkdodo.eu/blog/practical-react-query)