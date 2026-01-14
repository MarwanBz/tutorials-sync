# React Query Mutations: Modern Best Practices

> Mastering React Query mutations - from error handling to cache invalidation. Learn modern patterns that eliminate try/catch and make your code more maintainable.

---
Type: post
Date: 2026-01-10
Reading time: 10 min read
Tags: React Query, useMutation, Server State Management, TanStack Query, Error Handling
---

# React Query Mutations: Modern Best Practices

You've been using React Query (TanStack Query) in your basma projects for a while. You know how to fetch data with `useQuery` and update things with `useMutation`. But are you handling mutations like a senior engineer?

Let's look at your code and level up your mutation game.

## The Old Way: Try/Catch Everywhere

Here's what many developers do when handling mutations:

```typescript
// ❌ OLD PATTERN - Manual try/catch
const handleSubmit = async (data: CreateRequestData) => {
  try {
    const response = await createRequest(data);
    toast.success("تم إرسال الطلب بنجاح");
    // Reset form, redirect, etc.
  } catch (error) {
    console.error("Failed to create request:", error);
    toast.error("فشل إرسال الطلب");
  }
};
```

**Problems with this approach:**
- Error handling is scattered across every component
- No centralized error tracking
- Cache invalidation must be done manually
- Loading states must be managed manually
- Hard to maintain consistency across the app

## Your Current Setup: Already Better!

Looking at your codebase, you're actually already using React Query patterns. Let's examine what you have:

**In `basma-admin-dashboard/src/hooks/useBuildingConfigs.ts:64-75`:**

```typescript
export function useCreateBuildingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBuildingConfigRequest) =>
      createBuildingConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buildingConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["buildingStatistics"] });
    },
  });
}
```

**This is good!** You're:
- ✅ Using `useMutation` instead of manual async/await
- ✅ Invalidating related queries on success
- ✅ Separating mutation logic into a custom hook

But we can make it even better.

## The Missing Piece: Error Handling Callbacks

Your mutation hooks don't have `onError` callbacks. This means errors are handled in the component instead of the hook. Let's add them:

```typescript
// ✅ ENHANCED PATTERN - With error handling
export function useCreateBuildingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBuildingConfigRequest) =>
      createBuildingConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buildingConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["buildingStatistics"] });
    },
    onError: (error) => {
      // Handle specific error types
      if (error.response?.status === 409) {
        toast.error("Building config already exists");
      } else {
        toast.error("Failed to create building config");
      }
    },
  });
}
```

## The Global Error Handling Pattern (TkDodo's Recommendation)

According to [TkDodo's definitive guide on React Query error handling](https://tkdodo.eu/blog/react-query-error-handling), the best practice is **centralized error handling** at the QueryClient level:

```typescript
// ✅ BEST PATTERN - Global error handling
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only show toasts for background refetch errors
      if (query.state.data !== undefined) {
        toast.error(`Background update failed: ${error.message}`);
      }
      // Foreground errors go to Error Boundaries
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      // All mutation errors get a toast
      toast.error(`Operation failed: ${error.message}`);
      // Also log to error tracking service
      logErrorToService(error);
    },
  }),
});
```

**Why this is better:**
- Errors are handled **once** in one place
- Consistent error messages across the app
- Easy to add error tracking (Sentry, LogRocket, etc.)
- Components don't need to worry about error display

## Mutate vs MutateAsync: Which to Use?

Looking at your mobile app's `NewRequestForm.tsx:218-232`:

```typescript
const handleSubmit = () => {
  // Validation...
  createMutation.mutate(requestData, {
    onSuccess: () => {
      // Reset form
      setTitle("");
      setDescription("");
      // ...
      onSuccess?.();
    },
  });
};
```

**You're using `mutate` - this is correct!**

Here's why from [TkDodo's mutations guide](https://tkdodo.eu/blog/mastering-mutations-in-react-query):

| Pattern | When to Use |
|---------|-------------|
| `mutate()` | 95% of cases. No error handling needed. |
| `mutateAsync()` | Only when you need the Promise for chaining multiple mutations. |

```typescript
// ❌ AVOID - Manual try/catch with mutateAsync
const onSubmit = async () => {
  try {
    const data = await myMutation.mutateAsync(someData);
    history.push(data.url);
  } catch (error) {
    // Do nothing...
  }
};

// ✅ PREFER - Callbacks handle everything
myMutation.mutate(someData, {
  onSuccess: (data) => history.push(data.url),
});
```

**The key insight:** `mutate` internally does `mutateAsync().catch(noop)` - React Query handles errors for you!

## Separation of Concerns: Hook vs Component Callbacks

This is a crucial concept from TkDodo. Callbacks on `useMutation` run **before** callbacks on `mutate()`. More importantly, `mutate` callbacks might not fire if the component unmounts!

```typescript
// ✅ CUSTOM HOOK - Logic-related callbacks
export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTodo,
    // Always runs - even if component unmounts
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', 'list'] });
    },
  });
}

// ✅ COMPONENT - UI-related callbacks
function TodoDetail() {
  const updateTodo = useUpdateTodo();

  return (
    <button
      onClick={() =>
        updateTodo.mutate(
          { title: 'newTitle' },
          // Only runs if we're still mounted
          { onSuccess: () => history.push('/todos') }
        )
      }
    >
      Update
    </button>
  );
}
```

**Rule of thumb:**
- **Hook callbacks**: Cache invalidation, data updates (always needed)
- **Component callbacks**: Redirects, toasts, UI feedback (only if user sees it)

## Optimistic Updates: Use Sparingly

TkDodo notes that optimistic updates are **overused**. They add complexity and can make UX worse if not done carefully.

```typescript
// ⚠️ OPTIMISTIC UPDATE - Only when instant feedback is critical
export function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      toggleTodo(id, done),

    onMutate: async ({ id, done }) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(['todos']);

      // Optimistically update
      queryClient.setQueryData(['todos'], (old) =>
        old?.map((todo) =>
          todo.id === id ? { ...todo, done } : todo
        )
      );

      return { previous };
    },

    onError: (_err, _variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['todos'], context.previous);
    },

    onSettled: () => {
      // Refetch to get server truth
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}
```

**When to use optimistic updates:**
- ✅ Toggle switches (like, bookmark, done)
- ✅ Actions that rarely fail
- ✅ When instant feedback is critical

**When to avoid:**
- ❌ Form submissions (redirects make rollback hard)
- ❌ Operations that might fail often
- ❌ Complex list updates (sorting, filtering)

## Direct Cache Updates vs Invalidation

TkDodo recommends **preferring invalidation** over direct cache updates:

```typescript
// ✅ PREFER - Invalidation (safe, simple)
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['posts', id, 'comments'] });
},

// ⚠️ USE SPARINGLY - Direct update (only when needed)
onSuccess: (newPost) => {
  queryClient.setQueryData(['posts', id], newPost);
},
```

**Why invalidation is usually better:**
- No frontend logic duplication
- Backend remains source of truth
- Handles complex cases (sorting, filtering, pagination)
- Less code to maintain

## Your Codebase: Specific Improvements

### 1. Add Error Callbacks to Your Hooks

**File:** `basma-admin-dashboard/src/hooks/useBuildingConfigs.ts`

```typescript
// Add onError to all mutations
export function useCreateBuildingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBuildingConfigRequest) =>
      createBuildingConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buildingConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["buildingStatistics"] });
    },
    // ✅ ADD THIS
    onError: (error) => {
      if (error.response?.status === 409) {
        toast.error("A building config with this name already exists");
      } else {
        toast.error("Failed to create building config");
      }
    },
  });
}
```

### 2. Set Up Global Error Handling

**File:** `basma-admin-dashboard/src/apis/client.ts` or create `src/lib/query-client.ts`

```typescript
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only notify for background refetch errors
      if (query.state.data !== undefined) {
        console.error("Background query error:", error);
        // Optional: toast for background errors
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error("Mutation error:", error);
      // All mutations get error handling here
    },
  }),
  defaultOptions: {
    mutations: {
      // Don't retry mutations by default
      retry: false,
    },
    queries: {
      // Retry queries 3 times by default
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});
```

### 3. Mobile App: Add Error Handling to Mutations

**File:** `basma-mobile/hooks/useRequests.ts` (or similar)

```typescript
export const useCreateRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRequestData) => createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (error) => {
      // Specific error messages based on error type
      if (error.response?.status === 400) {
        toast.error("يرجى التحقق من البيانات المدخلة");
      } else if (error.response?.status === 401) {
        toast.error("يرجى تسجيل الدخول مرة أخرى");
      } else {
        toast.error("فشل إرسال الطلب، يرجى المحاولة مرة أخرى");
      }
    },
  });
};
```

## Complete Example: Enhanced Mutation Hook

Here's a fully-featured mutation hook following all best practices:

```typescript
// hooks/useCreateTodo.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTodo } from "@/api/todos";
import { toast } from "sonner";

interface CreateTodoVariables {
  title: string;
  description?: string;
}

export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: CreateTodoVariables) =>
      createTodo(variables),

    // ✅ Update cache after success
    onSuccess: (data, variables) => {
      // Invalidate list query
      queryClient.invalidateQueries({ queryKey: ['todos'] });

      // Optionally update specific query directly
      if (variables.categoryId) {
        queryClient.invalidateQueries({
          queryKey: ['todos', { categoryId: variables.categoryId }]
        });
      }

      // ✅ Show success notification
      toast.success("Todo created successfully");
    },

    // ✅ Handle errors
    onError: (error) => {
      if (error.response?.status === 409) {
        toast.error("A todo with this title already exists");
      } else if (error.response?.status === 400) {
        toast.error("Invalid data provided");
      } else {
        toast.error("Failed to create todo");
      }
    },
  });
}

// ✅ Component usage - nice and clean
function CreateTodoForm() {
  const createTodo = useCreateTodo();

  const handleSubmit = (data: CreateTodoData) => {
    // No try/catch needed! React Query handles everything
    createTodo.mutate(data, {
      onSuccess: (data) => {
        // Optional: Component-specific success action
        router.push(`/todos/${data.id}`);
      },
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## Key Takeaways

| Concept | Best Practice |
|---------|---------------|
| **Error Handling** | Use `onError` callbacks, prefer global `MutationCache` |
| **Mutation Function** | Use `mutate()`, avoid `mutateAsync()` unless needed |
| **Callback Placement** | Logic in hook, UI feedback in component |
| **Cache Updates** | Prefer `invalidateQueries()` over `setQueryData()` |
| **Optimistic Updates** | Use sparingly, only for instant feedback needs |
| **Try/Catch** | Not needed with React Query mutations |

## Try It Yourself

Here are challenges for your basma projects:

1. **Add Global Error Handling**: Set up `MutationCache` error handler in both dashboard and mobile app.

2. **Enhance Existing Hooks**: Add `onError` callbacks to all mutation hooks in:
   - `basma-admin-dashboard/src/hooks/useBuildingConfigs.ts`
   - `basma-mobile/hooks/useRequests.ts`

3. **Remove Unnecessary Try/Catch**: Find places where you're doing try/catch around React Query mutations and remove them.

4. **Test Error States**: Try network throttling in DevTools to see how your error handling works.

---

## Summary

* **React Query eliminates the need for try/catch** in most mutation scenarios
* **Global error handling** via `MutationCache` provides consistent error UX
* **`mutate()` over `mutateAsync()`** unless you need Promise chaining
* **Separate concerns**: Hook handles cache, component handles UI
* **Prefer invalidation** over direct cache updates
* **Optimistic updates** are powerful but add complexity—use sparingly

The philosophy: **Let React Query handle the plumbing so you can focus on the user experience.**

---

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]

## Further Reading

- [TkDodo: React Query Error Handling](https://tkdodo.eu/blog/react-query-error-handling)
- [TkDodo: Mastering Mutations in React Query](https://tkdodo.eu/blog/mastering-mutations-in-react-query)
- [TanStack Query Official Docs](https://tanstack.com/query/latest)