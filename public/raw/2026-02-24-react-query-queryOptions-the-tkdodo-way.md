# React Query queryOptions: The TkDodo Way

> Learn the queryOptions pattern from TkDodo for React Query v5 - separating query configuration from execution for better composability, type inference, and prefetching.

---
Type: post
Date: 2026-02-24
Reading time: 10 min read
---

# React Query queryOptions: The TkDodo Way

> Based on TkDodo's article: [Creating Query Abstractions](https://tkdodo.eu/blog/creating-query-abstractions)
>
> Why this matters: React Query v5 introduced `queryOptions` - a pattern that changes how we think about sharing query configurations.

---

## Part 1: The Problem with Custom Hooks

### What We've All Been Doing

You probably have code like this in your project:

```typescript
// hooks/useProducts.ts
export function useProducts(filters?: ProductFilters, locale?: string) {
  return useQuery({
    queryKey: ['products', filters, locale],
    queryFn: () => getProducts(filters),
    staleTime: 5 * 60 * 1000,
  })
}

// Used in components
function ProductsPage() {
  const { data, isLoading } = useProducts(filters, locale)
  // ...
}
```

This works! So what's the problem?

### The Limitations

| Problem | Why It Matters |
|---------|----------------|
| **Component-only** | Can't prefetch data in event handlers or loaders |
| **Hard to compose** | Want to use `useSuspenseQuery` instead? Need a new hook |
| **TypeScript friction** | Need to manually type `UseQueryResult<Type>` everywhere |
| **Can't extend easily** | Want different `staleTime` in one place? Add a parameter |

### Real-World Pain Point

Imagine you want to prefetch product data when someone hovers over a link:

```typescript
// ❌ This doesn't work! useProducts is a hook, must be called in component
function ProductLink({ productId }) {
  const handleMouseEnter = () => {
    useProducts(/* ... */) // HOOK RULE VIOLATION!
  }
}
```

You'd need to use `queryClient.prefetchQuery` with manual query key construction - error-prone and breaks DRY.

---

## Part 2: The `queryOptions` Solution

### The Basic Idea

Instead of a hook that **does** the query, create a function that **describes** the query:

```typescript
import { queryOptions } from '@tanstack/react-query'

export function productsOptions(filters?: ProductFilters, locale?: string) {
  return queryOptions({
    queryKey: ['products', filters, locale],
    queryFn: () => getProducts(filters),
    staleTime: 5 * 60 * 1000,
  })
}
```

**What changed?**
- It's a regular function, not a hook
- It returns a configuration object, not the query result
- It can be used anywhere

### Usage Comparison

```typescript
// BEFORE: Custom hook
const { data } = useProducts(filters, locale)

// AFTER: queryOptions + useQuery
const { data } = useQuery(productsOptions(filters, locale))
```

Slightly more verbose? Yes. But look what you gain:

```typescript
// ✅ Prefetch in event handler
function ProductLink({ productId }) {
  const queryClient = useQueryClient()

  const handleMouseEnter = () => {
    queryClient.prefetchQuery(productOptions(productId))
  }

  return <a onMouseEnter={handleMouseEnter}>Product {productId}</a>
}

// ✅ Use in a loader (Next.js/React Router)
export async function loader({ params }) {
  return defer({
    products: queryClient.fetchQuery(productsOptions(filters, params.locale))
  })
}

// ✅ Override options at call site
const { data } = useQuery({
  ...productsOptions(filters, locale),
  staleTime: 0, // Real-time for dashboard
  refetchInterval: 5000,
})
```

---

## Part 3: Why TkDodo Recommends This

### Key Quote

> "The best abstractions are not configurable."

Your `productsOptions` contains only what's **shared** across all usages. Each call site can add its own options.

### The Composition Win

```typescript
// Define once
export function productOptions(id: string | number) {
  return queryOptions({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  })
}

// Use with different hooks!
const { data } = useQuery(productOptions(123))           // Regular
const { data } = useSuspenseQuery(productOptions(123))   // Suspense
await queryClient.prefetchQuery(productOptions(123))     // Prefetch

// Use in parallel queries
const results = useQueries({
  queries: [1, 2, 3].map(id => productOptions(id))
})
```

One options function → works with **any** React Query hook.

---

## Part 4: TypeScript Benefits

### The Old Way (Manual Types)

```typescript
export function useProducts(filters?: ProductFilters): UseQueryResult<ProductsResponse> {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => getProducts(filters),
  })
}
```

Problems:
- Manual generic annotation required
- What if `select` changes the return type?
- Complex to extract the `data` type elsewhere

### The New Way (Inferred Types)

```typescript
export function productsOptions(filters?: ProductFilters) {
  return queryOptions({
    queryKey: ['products', filters],
    queryFn: () => getProducts(filters),
  })
}

// Type is automatically inferred as ProductsResponse
const { data } = useQuery(productsOptions())
```

Even better, you can extract the type:

```typescript
import type { inferQueryOptions } from '@tanstack/react-query'

type ProductsData = inferQueryOptions<ReturnType<typeof productsOptions>>['data']
```

---

## Part 5: Real Patterns from Your Codebase

### Pattern 1: Simple Query (No Parameters)

```typescript
// OLD
export function useBrands(): UseQueryResult<Brand[]> {
  return useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
    staleTime: 10 * 60 * 1000,
  })
}

// NEW
export const brandsOptions = queryOptions({
  queryKey: ['brands'],
  queryFn: getBrands,
  staleTime: 10 * 60 * 1000,
})
```

### Pattern 2: Query with Single Parameter

```typescript
// OLD
export function useProduct(id: string | number): UseQueryResult<Product> {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
    enabled: !!id,
  })
}

// NEW
export const productOptions = (id: string | number) => queryOptions({
  queryKey: ['product', id],
  queryFn: () => getProduct(id),
  enabled: !!id,
})
```

### Pattern 3: Query with Locale

```typescript
// OLD - locale is captured inside the hook
export function useTopCategories() {
  const locale = useLocale()
  return useQuery<TopCategory[]>({
    queryKey: ['top-categories', locale],
    queryFn: getTopCategories,
    staleTime: 5 * 60 * 1000,
  })
}

// NEW - locale is explicit parameter
export const topCategoriesOptions = (locale?: string) => queryOptions({
  queryKey: ['top-categories', locale],
  queryFn: getTopCategories,
  staleTime: 5 * 60 * 1000,
})

// Usage - explicit is better than implicit
function TopCategories() {
  const locale = useLocale()
  const { data } = useQuery(topCategoriesOptions(locale))
}
```

**Why this is better:** You can now fetch categories for ANY locale, not just the current one.

### Pattern 4: Conditional Query with `enabled`

```typescript
// OLD
export function useSubcategories(categoryId: number | null) {
  return useQuery<SubCategory[]>({
    queryKey: ['subcategories', categoryId],
    queryFn: () => getSubcategoriesByCategoryId(categoryId!),
    enabled: !!categoryId && categoryId !== 0,
  })
}

// NEW
export const subcategoriesOptions = (categoryId: number | null) => queryOptions({
  queryKey: ['subcategories', categoryId],
  queryFn: () => getSubcategoriesByCategoryId(categoryId!),
  enabled: !!categoryId && categoryId !== 0,
})
```

The `enabled` logic stays the same - it's part of the query configuration.

### Pattern 5: Multiple Variants

```typescript
// OLD - separate hooks
export function useCurrentOrders(): UseQueryResult<OrdersResponse> {
  return useQuery({
    queryKey: ['orders', { type: 'current' }],
    queryFn: getCurrentOrders,
    staleTime: 2 * 60 * 1000,
  })
}

export function usePreviousOrders(): UseQueryResult<OrdersResponse> {
  return useQuery({
    queryKey: ['orders', { type: 'previous' }],
    queryFn: getPreviousOrders,
    staleTime: 10 * 60 * 1000,
  })
}

// NEW - unified with parameter
export const ordersByTimeframeOptions = (timeframe: 'current' | 'previous') =>
  queryOptions({
    queryKey: ['orders', { type: timeframe }],
    queryFn: timeframe === 'current' ? getCurrentOrders : getPreviousOrders,
    staleTime: timeframe === 'current' ? 2 * 60 * 1000 : 10 * 60 * 1000,
  })
```

---

## Part 6: Practical Migration Strategy

### Phase 1: Coexistence (No Breaking Changes)

```typescript
// Add options alongside existing hooks
export const productsOptions = (filters?: ProductFilters, locale?: string) =>
  queryOptions({
    queryKey: ['products', filters, locale],
    queryFn: () => getProducts(filters),
    staleTime: 5 * 60 * 1000,
  })

// Keep the hook - now it wraps the options
export function useProducts(filters?: ProductFilters, locale?: string) {
  return useQuery(productsOptions(filters, locale))
}
```

No existing code breaks. The options function is available for new code.

### Phase 2: Use in New Features

```typescript
// New feature using queryOptions
export function productReviewsOptions(productId: number) {
  return queryOptions({
    queryKey: ['product-reviews', productId],
    queryFn: () => getProductReviews(productId),
    enabled: !!productId,
  })
}

// Prefetch on hover - the killer feature
function ProductCard({ product }) {
  const queryClient = useQueryClient()

  return (
    <Link
      href={`/products/${product.id}`}
      onMouseEnter={() =>
        queryClient.prefetchQuery(productReviewsOptions(product.id))
      }
    >
      {product.name}
    </Link>
  )
}
```

### Phase 3: Gradual Refactoring (Optional)

Migrate old hooks when:
- You're already touching the file
- You need prefetching for that query
- You have time and want consistency

---

## Part 7: When Should You Actually Care?

### Stick with Custom Hooks If:

- ✅ Your app is client-side only
- ✅ You never need to prefetch outside components
- ✅ You don't use Server Components
- ✅ The current pattern works fine for your team

### Adopt queryOptions If:

- ⚠️ You're using Next.js App Router / Server Components
- ⚠️ You need to prefetch data in event handlers
- ⚠️ You want to use the same query with `useQuery` AND `useSuspenseQuery`
- ⚠️ You're tired of manual TypeScript generics

### Must Migrate If:

- 🚨 You're building a library with reusable data fetching
- 🚨 You need to share queries between client and server
- 🚨 You want to use React Server Components

---

## Part 8: Common Patterns Reference

### Prefetch on Navigation

```typescript
import { useNavigate } from 'react-router-dom'

function ProductLink({ id }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleClick = () => {
    // Prefetch before navigating
    queryClient.prefetchQuery(productOptions(id))
    navigate(`/products/${id}`)
  }

  return <button onClick={handleClick}>View Product</button>
}
```

### Prefetch on Hover

```typescript
function CategoryLink({ categoryId }) {
  const queryClient = useQueryClient()

  return (
    <Link
      to={`/categories/${categoryId}`}
      onMouseEnter={() =>
        queryClient.prefetchQuery(categoryProductsOptions(categoryId))
      }
    >
      View Category
    </Link>
  )
}
```

### Parallel Queries with `useQueries`

```typescript
function Dashboard() {
  const [orders, products, users] = useQueries({
    queries: [
      ordersOptions({ type: 'current' }),
      productsOptions({ limit: 10 }),
      usersOptions(),
    ],
  })

  if (orders.isLoading || products.isLoading || users.isLoading) {
    return <Loading />
  }

  return (
    <div>
      <h2>{orders.data?.length} Orders</h2>
      <h2>{products.data?.length} Products</h2>
      <h2>{users.data?.length} Users</h2>
    </div>
  )
}
```

### Mutation Invalidation (Type-Safe!)

```typescript
function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (product: Product) => updateProduct(product),
    onSuccess: (updatedProduct) => {
      // No string literals! Type-safe query key
      queryClient.setQueryData(
        productOptions(updatedProduct.id).queryKey,
        updatedProduct
      )
    },
  })
}
```

---

## Part 9: The "Why" - Mental Model Shift

### Old Mental Model

```
Component → Hook → Query
```

The hook IS the query. Tightly coupled.

### New Mental Model

```
Query Options → Hook OR Loader OR Event Handler
```

Query options are **configuration**. They can be used anywhere.

### TkDodo's Insight

> "Custom hooks are great for sharing logic between components. But we're not sharing logic here - we're sharing configuration."

`queryOptions` separates **what** to fetch from **where/how** it's used.

---

## Part 10: Quick Decision Tree

```
Need to fetch data in a component?
├─ Yes → Use useQuery(yourOptions())
└─ No → Can you use queryOptions elsewhere?
    ├─ Yes → queryClient.prefetchQuery(yourOptions())
    ├─ Yes → await queryClient.fetchQuery(yourOptions())
    └─ Yes → useSuspenseQuery(yourOptions())
```

---

## Summary Checklist

| Concept | Remember |
|---------|----------|
| **queryOptions** | Returns configuration, not data |
| **Use it when** | You need the query in multiple places |
| **Don't refactor** | If your current code works |
| **Start new** | Use queryOptions for new features |
| **Keep hooks** | As thin wrappers if your team prefers |

---

## Further Reading

- [TkDodo: The Query Options API](https://tkdodo.eu/blog/the-query-options-api)
- [TkDodo: React Query Render Optimizations](https://tkdodo.eu/blog/react-query-render-optimizations)
- [TanStack Query Docs: queryOptions](https://tanstack.com/query/latest/docs/framework/react/guides/query-options)

---

## TL;DR Code Cheat Sheet

```typescript
// Define
export const productsOptions = (filters?: ProductFilters) => queryOptions({
  queryKey: ['products', filters],
  queryFn: () => getProducts(filters),
  staleTime: 5 * 60 * 1000,
})

// Use in component
const { data } = useQuery(productsOptions())

// Prefetch
queryClient.prefetchQuery(productsOptions())

// Override options
const { data } = useQuery({ ...productsOptions(), staleTime: 0 })

// Parallel queries
const results = useQueries({
  queries: [filter1, filter2].map(f => productsOptions(f))
})
```