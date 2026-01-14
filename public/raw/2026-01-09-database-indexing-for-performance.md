# Database Indexing for Performance

> Deep dive into database indexing: how indexes work under the hood (B-trees), when to add them in production, and practical analysis of the maintenance request system's Prisma schema with specific optimization recommendations.

---
Type: post
Date: 2026-01-09
Reading time: 13 min read
Tags: Database Index, Query Optimization, Prisma, MySQL, Performance
---

# Database Indexing for Performance

## Why This Matters

As your maintenance request system grows, you'll face a critical bottleneck: database queries that were fast with 100 requests become painfully slow with 10,000. The difference between a 50ms query and a 2-second query isn't just user experience—it's whether your system can handle load without crashing.

Indexing is the single most impactful database optimization you can make. But here's the trap: most developers add indexes reactively ("this query is slow, add an index") rather than proactively understanding their query patterns. This tutorial will give you the mental model to design indexes strategically, not desperately.

## The Problem

Look at this query in your codebase:

**Location:** `src/services/request.service.ts:120-219`

```typescript
async getRequests(filters: GetRequestsQueryInput["query"], userRole: string, userId?: string) {
  const where: any = {};

  // Role-based filtering
  if (userRole === "CUSTOMER" && userId) {
    where.requestedById = userId;
  }

  // Multiple filter conditions
  if (queryFilters.status) {
    where.status = queryFilters.status;
  }
  if (queryFilters.priority) {
    where.priority = queryFilters.priority;
  }
  if (queryFilters.categoryId) {
    where.categoryId = queryFilters.categoryId;
  }

  const [requests, total] = await Promise.all([
    prisma.maintenance_request.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" }
    }),
    prisma.maintenance_request.count({ where })
  ]);
}
```

When this query runs, MySQL has three options:

1. **Sequential Scan** (Table Scan): Read every single row in `maintenance_requests` and check if it matches the WHERE conditions. With 10,000 rows, that's 10,000 comparisons.

2. **Index Lookup**: Jump directly to matching rows using a pre-sorted data structure. With the right index, MySQL might read only 50 rows to find 10 matches.

3. **Wrong Index**: MySQL chooses an index that doesn't match your query pattern, making it *slower* than no index at all.

The difference: **50ms vs 2,000ms**. That's the stakes.

## Key Concepts

### What Is an Index, Really?

An index is a **separate data structure** that stores a subset of your table's columns in a sorted format. Think of it as a B-tree (balanced tree) structure:

```
                    [Root Node]
                   /            \
            [M]                    [S-Z]
           /    \                 /     \
    [A-D]      [E-L]        [P-R]      [T-Z]
   / | \       / | \        / | \      / | \
  A  B  C    E  ... L     P  Q  R    T  ... Z
```

Each node in this tree contains:
- **Key values**: The indexed column's values (sorted)
- **Pointers**: References to either child nodes or actual table rows

**Critical Insight**: An index is *not* part of the table. It's a separate structure that takes additional disk space and must be updated on every INSERT/UPDATE/DELETE.

### Time Complexity Comparison

| Operation | No Index (Table Scan) | With B-Tree Index |
|-----------|----------------------|-------------------|
| Find one row | O(n) - Read every row | O(log n) - Tree traversal |
| Find 10 rows with filter | O(n) | O(log n + k) where k = matches |
| Insert new row | O(1) - Append to end | O(log n) - Update index + table |
| Update indexed column | O(1) | O(log n) - Find + update index |

With 1 million rows:
- Table scan: ~1,000,000 operations
- Index lookup: ~20 operations (log₂(1,000,000) ≈ 20)

### Index Selectivity: The Hidden Factor

Not all indexes are equally useful. **Selectivity** = (unique values / total rows). Higher selectivity = better index.

```sql
-- Example from your user table:
SELECT COUNT(DISTINCT email) / COUNT(*) as email_selectivity FROM users;
-- Result: ~1.0 (perfect - every email is unique)

SELECT COUNT(DISTINCT role) / COUNT(*) as role_selectivity FROM users;
-- Result: ~0.05 (terrible - only 5 unique roles)
```

**Rule of thumb**: Indexes on columns with selectivity < 0.01 are rarely useful. MySQL might ignore them entirely.

### Composite Indexes: Order Matters

A composite index on `[status, priority, createdAt]` can service queries that:
1. Filter by `status` only
2. Filter by `status` AND `priority`
3. Filter by `status` AND `priority` AND `createdAt`
4. Order by `createdAt` with WHERE on `status` and `priority`

But **NOT** queries that:
- Filter by `priority` alone
- Filter by `createdAt` alone
- Filter by `priority` AND `createdAt` without `status`

**Why?** B-trees are sorted left-to-right. Looking up by the second column requires knowing the first.

### Covering Indexes: The Performance Holy Grail

A "covering index" includes all columns needed by a query, allowing MySQL to answer the query **without reading the table at all**.

```sql
-- If you have index: `[requestedById, status, createdAt, id]`
-- This query never touches the table:
SELECT id, status, createdAt
FROM maintenance_requests
WHERE requestedById = 'user-123'
  AND status = 'IN_PROGRESS';
```

This is the fastest possible query type.

## Examples from Codebase

### Example 1: Missing Index on Frequently Filtered Column

**Location:** `src/services/technician.service.ts:7-20`

```typescript
async getAllTechnicians(page = 1, limit = 10) {
  const [technicians, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TECHNICIAN" },  // No index on role!
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where: { role: "TECHNICIAN" } }),
  ]);
}
```

**Problem:** The `role` column is filtered constantly but has no index. Every call scans the entire `users` table.

**Analysis from schema:** `src/prisma/schema.prisma:21-35`

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique  // Has index (unique constraint)
  phone     String?  @unique  // Has index (unique constraint)
  role      UserRole // NO INDEX - bottleneck!
  name      String?
  // ... other fields
}
```

**Solution:** Add `@@index([role])` to the User model.

**Tradeoff Analysis:**
- **Write cost:** Low. User creation/updates are infrequent relative to reads.
- **Storage cost:** Minimal (~4-8 bytes per user).
- **Selectivity:** Low (only ~5 roles), BUT filtering by role is extremely common.
- **Verdict:** Add the index. The low selectivity is acceptable because this is a primary filtering pattern.

### Example 2: Well-Indexed Composite Query

**Location:** `src/services/request.service.ts:164-180`

```typescript
if (userRole === "CUSTOMER" && userId) {
  where.requestedById = userId;
}
// ... later:
orderBy: { createdAt: "desc" }
```

**Schema index:** `src/prisma/schema.prisma:58`

```prisma
model maintenance_request {
  // ... fields
  requestedById String
  createdAt     DateTime @default(now())

  @@index([requestedById])
  @@index([createdAt])
}
```

**What's happening:** This query filters by `requestedById` and sorts by `createdAt`. MySQL can use the `requestedById` index for filtering, but must then sort all matching rows by `createdAt`.

**Better approach:** Composite index `[requestedById, createdAt]` would allow MySQL to:
1. Jump directly to this user's requests
2. Return them already sorted by `createdAt` (no extra sort needed)

**Current query plan:**
1. Index seek on `requestedById` → 100 rows found
2. Filesort those 100 rows by `createdAt` → O(n log n) operation
3. Return top 10

**With composite index:**
1. Index seek on `requestedById, createdAt` → 100 rows found (already sorted)
2. Return top 10

**Performance gain:** Eliminates the filesort operation.

### Example 3: The Search Anti-Pattern

**Location:** `src/services/request.service.ts:195-203`

```typescript
if (queryFilters.search) {
  where.OR = [
    { title: { contains: queryFilters.search, mode: "insensitive" } },
    { description: { contains: queryFilters.search, mode: "insensitive" } },
    { location: { contains: queryFilters.search, mode: "insensitive" } },
    { customIdentifier: { contains: queryFilters.search, mode: "insensitive" } }
  ];
}
```

**Problem:** Standard B-tree indexes **cannot** accelerate `LIKE '%term%'` queries (contains searches). They only help with prefix matches (`LIKE 'term%'`).

**What happens:**
1. MySQL checks each index separately
2. Each index scan still requires reading the table to verify the `contains` condition
3. Four separate scans are unioned together
4. This is often *slower* than a single table scan

**Solution:** For production search, you need:
1. **Full-text search** (MySQL FULLTEXT index or external service like Meilisearch)
2. **Trigram indexes** (pg_trigram in PostgreSQL, not available in MySQL)
3. **Dedicated search service** (Elasticsearch, Algolia, Typesense)

**Current reality:** This search will remain slow until you implement a proper search solution. No standard index will help here.

### Example 4: Perfect Covering Index

**Location:** `src/services/notification.service.ts` (implied from schema)

**Schema:** `src/prisma/schema.prisma:114`

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  createdAt DateTime @default(now())
  read      Boolean  @default(false)

  @@index([userId, createdAt])
}
```

**Typical query:** Get user's unread notifications, ordered by date

```typescript
async getUnreadNotifications(userId: string) {
  return await prisma.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: "desc" },
    take: 20
  });
}
```

**Why this is optimal:**
1. Composite index `[userId, createdAt]` covers the filter AND sort
2. MySQL jumps directly to this user's notifications
3. Rows are already sorted by `createdAt`
4. Top 20 rows returned immediately
5. **Zero table reads** (if the query only selects indexed columns)

**Performance:** O(log n + k) where k = 20. Constant time regardless of total notification count.

## Indexing Decision Framework

Use this checklist when considering a new index:

### Step 1: Identify the Query Pattern

**Ask yourself:**
- [ ] Is this query executed frequently (more than 10x per minute)?
- [ ] Is this query slow (>100ms)?
- [ ] Does this query touch more than 1,000 rows?

**If NO to all:** Don't index. Premature optimization = complex future bugs.

### Step 2: Analyze the Query

**For SELECT queries:**

```sql
-- Analyze a specific query:
EXPLAIN SELECT * FROM maintenance_requests
WHERE status = 'IN_PROGRESS'
  AND priority = 'HIGH';
```

Look for:
- `type: ALL` → Table scan (needs index)
- `type: ref` → Index lookup (good)
- `type: range` → Index range scan (good)
- `Using filesort` → Missing index for ORDER BY
- `Using temporary` → Missing index for GROUP BY

### Step 3: Choose Index Type

| Query Pattern | Recommended Index |
|--------------|-------------------|
| `WHERE col = value` | Single column on `col` |
| `WHERE col1 = x AND col2 = y` | Composite `[col1, col2]` |
| `WHERE col1 = x ORDER BY col2` | Composite `[col1, col2]` |
| `WHERE col LIKE 'prefix%'` | Single column on `col` |
| `WHERE col LIKE '%middle%'` | **No index helps** - use full-text |
| `ORDER BY col LIMIT n` | Single column on `col` |
| `GROUP BY col` | Single column on `col` |
| Multiple OR conditions | Consider multiple single-column indexes |

### Step 4: Evaluate Tradeoffs

**Write penalty calculation:**
```
Insert/Update time = base_time + (number_of_indexes × 20ms)
```

With 5 indexes: Every user signup costs +100ms.

**Storage calculation:**
```
Index size ≈ (number_of_rows × indexed_column_size × 1.5)
```

For 1M rows with UUID index: ~15MB storage per index.

**Verdict:**
- **Add index if:** Read frequency >> Write frequency AND query is currently slow
- **Skip index if:** Write-heavy table OR query already fast OR low selectivity column

### Step 5: Implement and Verify

**After adding index to schema:**

```bash
# Generate migration
npx prisma migrate dev --name add_role_index

# Verify index created
mysql> SHOW INDEX FROM users WHERE Key_name = 'role';

# Test query performance
mysql> EXPLAIN ANALYZE SELECT * FROM users WHERE role = 'TECHNICIAN';
```

**Expected outcome:**
- Query time reduced by >50%
- `EXPLAIN` shows `type: ref` or `type: range`
- No `Using filesort` or `Using temporary`

## Specific Recommendations for Your Codebase

Based on analysis of `src/prisma/schema.prisma` and query patterns in services:

### Immediate Wins (Add These Now)

1. **User.role index**
   ```prisma
   model User {
     // ... existing fields
     @@index([role])
   }
   ```
   **Rationale:** Filtered in `technician.service.ts` and likely auth checks throughout the app.

2. **MaintenanceRequest composite index**
   ```prisma
   model maintenance_request {
     // ... existing fields
     @@index([requestedById, createdAt])
   }
   ```
   **Rationale:** Covers the most common customer query pattern (get my requests, ordered by date).

3. **MaintenanceRequest composite index for technicians**
   ```prisma
   model maintenance_request {
     // ... existing fields
     @@index([assignedToId, status, createdAt])
   }
   ```
   **Rationale:** Technicians filter by their ID + status, sorted by date.

### Future Optimizations (Consider After Monitoring)

4. **RequestComment composite index**
   ```prisma
   model request_comment {
     // ... existing fields
     @@index([requestId, createdAt])
   }
   ```
   **Rationale:** Comments are always fetched per-request, ordered chronologically.

5. **Building index** (only if `contains` queries are replaced with exact matches)
   ```prisma
   model maintenance_request {
     building String? @db.VarChar(100)
     @@index([building])  // Currently exists but not useful for contains queries
   }
   ```
   **Current issue:** `building: { contains: ... }` queries don't use indexes. Consider exact match or prefix matching.

### Remove These (If They Exist)

No indexes should be removed currently. All existing indexes serve legitimate query patterns.

### Search Problem (Requires Different Solution)

The search functionality in `request.service.ts` cannot be fixed with standard indexes. Consider:

**Short-term (accept the limitation):**
- Document that search may be slow with >10,000 requests
- Add query timeout to prevent runaway queries
- Consider caching search results

**Long-term (implement proper search):**
```typescript
// Option 1: MySQL FULLTEXT (limited, no prefix search)
ALTER TABLE maintenance_requests ADD FULLTEXT(title, description);

// Option 2: External search service (recommended)
// - Meilisearch (self-hosted, easy)
// - Algolia (SaaS, expensive)
// - Typesense (open source, fast)
```

## Try It Yourself

**Exercise: Analyze and Optimize a Slow Query**

1. Open `src/services/user.service.ts` and find the `getAllUsers` method.

2. Create a test query that filters by role:

```typescript
// Add this method to user.service.ts:
async getUsersByRole(role: UserRole, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { role },
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where: { role } }),
  ]);
  return { users, total, page, limit };
}
```

3. Before adding the index, test the performance:
```bash
# In your database console
EXPLAIN SELECT * FROM users WHERE role = 'TECHNICIAN' ORDER BY created_at DESC LIMIT 10;
```

4. Add the index to `schema.prisma`:
```prisma
model User {
  // ... existing fields
  @@index([role, createdAt])
}
```

5. Run the migration and re-test:
```bash
npx prisma migrate dev --name add_role_createdat_index
```

6. Compare the `EXPLAIN` output. Notice:
- `type` changed from `ALL` to `ref`
- `rows` examined decreased significantly
- `Using filesort` disappeared (covered by index)

**Expected results:** Query time reduced from ~200ms to ~5ms with 10,000 users.

## Summary

**Key takeaways:**

1. **Indexes are separate data structures** (B-trees) that trade write performance and storage for read performance. They're not free—every INSERT/UPDATE/DELETE pays a penalty.

2. **Composite index order is critical**. An index on `[A, B, C]` can service queries filtering by A, A+B, or A+B+C—but NOT queries filtering by B or C alone.

3. **Selectivity matters**. Indexes on low-selectivity columns (like `role` with 5 values) are often skipped by the query planner, unless they're part of a composite index.

4. **Covering indexes are optimal**. When an index contains all columns needed by a query, MySQL can answer without reading the table at all—this is the fastest possible query execution.

5. **Search requires different tools**. Standard B-tree indexes cannot accelerate `LIKE '%term%'` queries. Use full-text search or external search services for search functionality.

6. **Measure before and after**. Use `EXPLAIN` and `EXPLAIN ANALYZE` to verify your indexes are actually being used. An unused index is pure cost with no benefit.

**For your maintenance request system specifically:**
- Add indexes on `User.role` and composite indexes on `maintenance_request` for common filter+sort patterns
- The search functionality will remain slow until you implement proper full-text search
- Monitor query performance with `EXPLAIN` before adding indexes—data-driven decisions beat assumptions

---

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]