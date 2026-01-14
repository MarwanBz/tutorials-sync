# Databases, Relations & SQL

> Understanding databases, how Prisma ORM works, SQL relationships, and data modeling fundamentals - connecting your code to persistent storage.

---
Type: post
Date: 2025-12-28
Reading time: 13 min read
Tags: Database, Prisma, SQL, Relations, CRUD, Data Modeling
---

# Databases, Relations & SQL

You've learned how requests flow through your server and how middleware transforms them. But here's the critical question: **where does the data actually live?**

When you create a maintenance request, update a user, or assign a task - where does that information go? What happens when your server restarts?

This is where databases come in. Understanding databases is what separates "my app works" from "I can build anything that persists data."

## The Problem: Data Needs to Outlive Your Code

Your variables disappear when your function finishes. Your objects disappear when your server restarts. But your business data? It needs to **survive**.

Look at your `prisma/schema.prisma:10-41`:

```prisma
model user {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(99)
  email     String   @unique @db.VarChar(99)
  role      user_role @default(USER)
  // ... many more fields
}
```

This isn't just TypeScript types. It's the **blueprint for your database**. Every field, every relationship, every rule gets translated into SQL and stored permanently.

**Without understanding databases, you're:**
- Flying blind on why queries are slow
- Not understanding foreign key constraints
- Confused about why relations don't load
- Missing data integrity concepts

Let's demystify databases.

## Key Concepts

### What is a Database?

Think of a database as a **super-powered spreadsheet system**:

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (MySQL)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   users      │  │  requests    │  │  categories  │      │
│  │   table      │  │   table      │  │   table      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                    RELATIONSHIPS                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key differences from spreadsheets:**
- **Tables** have relationships (users → requests)
- **Constraints** enforce rules (email must be unique)
- **Indexes** make queries fast
- **Transactions** keep data consistent
- **Concurrency** handles multiple users at once

### What is Prisma?

Prisma is an **ORM** (Object-Relational Mapper). It's a translator between:

1. **Your TypeScript code** (objects, types, functions)
2. **SQL database** (tables, rows, foreign keys)

**Without Prisma:**
```sql
-- Raw SQL (what you'd write without Prisma)
INSERT INTO users (id, name, email, role, created_at, updated_at)
VALUES (UUID(), 'Marwan', 'marwan@example.com', 'USER', NOW(), NOW());
```

**With Prisma:**
```typescript
await prisma.user.create({
  data: { name: 'Marwan', email: 'marwan@example.com' }
});
```

Prisma generates TypeScript types from your schema, writes SQL for you, and gives you autocomplete. **You write TypeScript, Prisma writes SQL.**

### Tables, Rows, and Columns

Every database has **tables** (like your Prisma models):

| Term in Prisma | Term in Database | What it means |
|----------------|-----------------|---------------|
| `model user` | Table `users` | Collection of user data |
| Field definition | Column | A property (name, email, etc.) |
| `prisma.user.create()` | INSERT row | Add one user |
| `prisma.user.findMany()` | SELECT rows | Get users |

**Your user table stores rows like this:**

| id | name | email | role | created_at |
|----|------|-------|------|------------|
| abc-123 | Marwan | marwan@example.com | USER | 2025-12-28 |
| def-456 | Ahmed | ahmed@example.com | ADMIN | 2025-12-27 |

Each row is one user. Each column is one property.

### Relationships: Connecting Tables

This is where databases get powerful. Look at your `maintenance_request` model (`prisma/schema.prisma:57-102`):

```prisma
model maintenance_request {
  id            String    @id @default(uuid())
  title         String    @db.VarChar(200)
  requestedById String
  assignedToId  String?

  requestedBy user  @relation("RequestCreator", fields: [requestedById], references: [id])
  assignedTo  user? @relation("RequestAssignee", fields: [assignedToId], references: [id])
}
```

**What this means:**

```
┌─────────────────┐         ┌──────────────────────────────┐
│     users       │         │    maintenance_requests      │
├─────────────────┤         ├──────────────────────────────┤
│ id (PK)         │◄────────│ requestedById (FK)          │
│ name            │         │ title                        │
│ email           │         │ assignedToId (FK) ──────────►│ id (PK)
│ role            │         │ description                  │
└─────────────────┘         │ status                       │
                             └──────────────────────────────┘
```

- **PK = Primary Key**: Unique ID for each row (`@id`)
- **FK = Foreign Key**: Points to another table's primary key

**Why this matters:** You can't assign a request to a non-existent user. The database **enforces this rule**.

### The CRUD Operations

Every database app does four things (CRUD):

**C**reate - Add new data
**R**ead - Fetch data
**U**pdate - Modify existing data
**D**elete - Remove data

**In Prisma, your service layer does this:**

```typescript
// CREATE
prisma.maintenance_request.create({ data: { ... } })

// READ
prisma.maintenance_request.findMany({ where: { status: "OPEN" } })

// UPDATE
prisma.maintenance_request.update({ where: { id }, data: { status: "CLOSED" } })

// DELETE
prisma.maintenance_request.delete({ where: { id } })
```

Each operation generates SQL behind the scenes.

### Foreign Keys & Referential Integrity

Look at the `onDelete: Cascade` in your schema (`prisma/schema.prisma:112`):

```prisma
model request_comment {
  id       String  @id @default(uuid())
  userId   String
  requestId String

  request maintenance_request @relation(fields: [requestId], references: [id], onDelete: Cascade)
  user    user                @relation(fields: [userId], references: [id])
}
```

**What `onDelete: Cascade` means:**

If you delete a request, **all its comments are automatically deleted too**.

```
DELETE FROM maintenance_requests WHERE id = 'abc-123'
       ↓
     CASCADE
       ↓
DELETE FROM request_comments WHERE request_id = 'abc-123'
```

**Without cascade:** You'd have orphaned comments pointing to non-existent requests.

**Other options:**
- `Restrict` - Can't delete if comments exist
- `SetNull` - Comments stay, but requestId becomes NULL
- `NoAction` - Do nothing (dangerous - creates orphans)

### Database Indexes: Speed Demons

See all those `@@index` lines in your schema? (`prisma/schema.prisma:91-100`)

```prisma
model maintenance_request {
  // ... fields ...

  @@index([status])
  @@index([priority])
  @@index([categoryId])
  @@index([requestedById])
}
```

**Indexes make queries FAST.**

Think of your database like a book:
- **Without index:** Read every page to find a word (slow!)
- **With index:** Check the index first, jump to the right page (fast!)

```sql
-- Without index: Scans entire table (slow)
SELECT * FROM maintenance_requests WHERE status = 'OPEN';

-- With index on status: Jumps directly to OPEN requests (fast!)
```

**Trade-off:** Indexes make reads faster, but writes slightly slower (database updates index too).

### SQL Under the Hood

Prisma generates SQL for you. Here's what actually happens:

**Your Prisma code:**
```typescript
prisma.maintenance_request.create({
  data: { title: "Fix AC", requestedById: "user-123" }
})
```

**SQL Prisma generates:**
```sql
INSERT INTO maintenance_requests (id, title, requested_by_id, status, created_at, updated_at)
VALUES (UUID(), "Fix AC", "user-123", "SUBMITTED", NOW(), NOW());
```

**Your Prisma code:**
```typescript
prisma.maintenance_request.findMany({
  where: { status: "OPEN" },
  include: { requestedBy: true }
})
```

**SQL Prisma generates:**
```sql
SELECT
  r.id, r.title, r.status,
  u.id, u.name, u.email
FROM maintenance_requests r
INNER JOIN users u ON r.requested_by_id = u.id
WHERE r.status = 'OPEN';
```

You don't write SQL - Prisma does. But understanding what it generates helps you optimize.

## Examples from Codebase

### Example 1: Creating with Relations

**Location:** `src/services/request.service.ts:43-79`

```typescript
const request = await prisma.maintenance_request.create({
  data: {
    title: data.title,
    description: data.description,
    priority: data.priority,
    categoryId: data.categoryId,  // ← Foreign key to categories table
    location: data.location,
    requestedById: userId,         // ← Foreign key to users table
    customIdentifier,
    status: "SUBMITTED",
  },
  include: {  // ← Also fetch related data
    category: true,
    requestedBy: { select: { id: true, name: true, email: true, role: true } },
    assignedTo: { select: { id: true, name: true, email: true, role: true } },
  },
});
```

**What's happening:**

1. Prisma creates a row in `maintenance_requests` table
2. Sets `categoryId` and `requestedById` to point to existing rows
3. Database **validates** those IDs exist (foreign key constraint)
4. If invalid, throws error before inserting
5. `include` tells Prisma to JOIN with users and categories tables
6. Returns request with user and category data in one query

**Why this matters:** You can't create requests for non-existent categories or users. The database protects your data integrity.

---

### Example 2: Complex Queries with Filtering

**Location:** `src/services/request.service.ts:123-200`

```typescript
const where: any = {};

// Role-based filtering
if (userRole === "CUSTOMER" && userId) {
  where.requestedById = userId;  // ← Customers only see their requests
}

// Apply query filters
if (queryFilters.status) {
  where.status = queryFilters.status;
}
if (queryFilters.priority) {
  where.priority = queryFilters.priority;
}
if (queryFilters.search) {
  where.OR = [
    { title: { contains: queryFilters.search } },
    { description: { contains: queryFilters.search } },
  ];
}

const [requests, total] = await Promise.all([
  prisma.maintenance_request.findMany({
    where,
    skip,  // Pagination offset
    take: limit,  // Number of records
    orderBy: { [sortBy]: sortOrder },  // Sorting
    include: {
      category: true,
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
    },
  }),
  prisma.maintenance_request.count({ where }),  // Total count for pagination
]);
```

**What's happening:**

1. **Dynamic WHERE clause:** Build filters based on user input
2. **Role-based access:** Customers filtered to their own requests
3. **Text search:** `contains` does `LIKE %search%` in SQL
4. **Pagination:** `skip` and `take` limit results
5. **Sorting:** Order by any field, ascending or descending
6. **Parallel queries:** `Promise.all` runs count and fetch simultaneously
7. **Eager loading:** `include` fetches relations in same query (no N+1 problem!)

**Generated SQL (simplified):**
```sql
SELECT r.*, c.*, u1.*, u2.*
FROM maintenance_requests r
LEFT JOIN request_categories c ON r.category_id = c.id
LEFT JOIN users u1 ON r.requested_by_id = u1.id
LEFT JOIN users u2 ON r.assigned_to_id = u2.id
WHERE r.requested_by_id = 'user-123'
  AND r.status = 'OPEN'
  AND (r.title LIKE '%search%' OR r.description LIKE '%search%')
ORDER BY r.created_at DESC
LIMIT 10 OFFSET 0;

SELECT COUNT(*) FROM maintenance_requests
WHERE requested_by_id = 'user-123' AND status = 'OPEN';
```

---

### Example 3: Schema Design - One-to-Many Relation

**Location:** `prisma/schema.prisma:10-41` and `prisma/schema.prisma:57-102`

```prisma
model user {
  id               String                @id @default(uuid())
  name             String                @db.VarChar(99)
  // ... other fields ...

  // One user can create many requests
  requestsCreated  maintenance_request[] @relation("RequestCreator")

  // One user can be assigned many requests
  requestsAssigned maintenance_request[] @relation("RequestAssignee")
}

model maintenance_request {
  id             String  @id @default(uuid())
  title          String  @db.VarChar(200)
  requestedById  String
  assignedToId   String?

  // Each request has one creator
  requestedBy    user    @relation("RequestCreator", fields: [requestedById], references: [id])

  // Each request has one assignee (optional)
  assignedTo     user?   @relation("RequestAssignee", fields: [assignedToId], references: [id])
}
```

**What this represents:**

```
┌─────────────────────┐
│        USER         │
├─────────────────────┤
│ id: user-123        │
│ name: Marwan        │──────┐
└─────────────────────┘      │
                              │ One-to-Many
                              │
                ┌─────────────┴──────────────────┐
                │                                │
                ▼                                ▼
        ┌───────────────┐              ┌───────────────┐
│   REQUEST 1    │              │   REQUEST 2    │
│   creator: user-123 │──────────────│   creator: user-123 │
└───────────────┘              └───────────────┘
```

**Key concepts:**
- **Array on user side** (`requestsCreated[]`): One user has many requests
- **Single field on request side** (`requestedById`): Each request has one creator
- **Relation name** (`"RequestCreator"`): Links the two sides together
- **Foreign key** (`fields: [requestedById]`): Which column stores the reference

**In your service:** You can query either direction:

```typescript
// Get user with their requests
const userWithRequests = prisma.user.findUnique({
  where: { id: userId },
  include: { requestsCreated: true }
});

// Or get request with creator
const requestWithCreator = prisma.maintenance_request.findUnique({
  where: { id: requestId },
  include: { requestedBy: true }
});
```

---

### Example 4: Schema Design - Many-to-Many with Junction Table

**Location:** `prisma/schema.prisma:138-158`

```prisma
model user {
  // ... fields ...
  newAssignments request_assignment_history[] @relation("NewAssignee")
}

model maintenance_request {
  // ... fields ...
  assignmentHistory request_assignment_history[]
}

model request_assignment_history {
  id               String              @id @default(uuid())
  fromTechnicianId String?
  toTechnicianId   String?
  assignmentType   assignment_type
  reason           String?             @db.VarChar(500)
  createdAt        DateTime            @default(now())
  assignedById     String
  requestId        String

  assignedBy       user                @relation("AssignmentChanger", fields: [assignedById], references: [id])
  fromTechnician   user?               @relation("PreviousAssignee", fields: [fromTechnicianId], references: [id])
  request          maintenance_request @relation(fields: [requestId], references: [id], onDelete: Cascade)
  toTechnician     user?               @relation("NewAssignee", fields: [toTechnicianId], references: [id])
}
```

**What this represents:**

```
┌─────────────┐                    ┌─────────────┐
│     USER    │                    │   REQUEST   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │         ┌────────────────────────┘
       │         │
       │    ┌────▼─────────────────────────┐
       │    │  request_assignment_history │
       │    │  (Junction Table)             │
       │    ├──────────────────────────────┤
       │    │ id: abc-123                  │
       │    │ fromTechnicianId: user-1     │
       │    │ toTechnicianId: user-2       │
       │    │ requestId: req-123           │
       │    │ assignmentType: REASSIGNMENT │
       │    │ createdAt: 2025-12-28        │
       │    └──────────────────────────────┘
```

**Why a junction table?**

Requests get assigned and reassigned. You need to track **history**, not just current state.

This junction table captures:
- WHO made the assignment (`assignedById`)
- WHO was assigned before (`fromTechnicianId`)
- WHO was assigned after (`toTechnicianId`)
- WHAT type of assignment (`assignmentType`)
- WHY the change happened (`reason`)
- WHEN it happened (`createdAt`)

**Without this table:** You'd lose history. You wouldn't know "Ahmed reassigned this from Hassan to Fatima on Tuesday."

---

### Example 5: Transaction for Data Consistency

**Location:** `src/services/request.service.ts:82-90`

```typescript
// Create initial status history entry
await prisma.request_status_history.create({
  data: {
    fromStatus: null,
    toStatus: "SUBMITTED",
    reason: "Request created",
    changedById: userId,
    requestId: request.id,
  },
});
```

This is after the request is created. But what if this fails? You'd have a request without status history.

**Better approach - use a transaction:**

```typescript
await prisma.$transaction([
  // Create request
  prisma.maintenance_request.create({
    data: { /* ... */ }
  }),

  // Create status history
  prisma.request_status_history.create({
    data: {
      requestId: request.id,
      toStatus: "SUBMITTED",
      changedById: userId,
    }
  })
]);
```

**With transactions:** Either BOTH succeed, or BOTH fail. No half-created data.

## Try It Yourself

**Exercise: Add a New Field with Migration**

1. Add a new field to your `prisma/schema.prisma`:

```prisma
model maintenance_request {
  // ... existing fields ...

  // Add this new field:
  tags String? @db.VarChar(500)  // Comma-separated tags like "urgent, electrical"
}
```

2. Create and run the migration:

```bash
npx prisma migrate dev --name add_tags_to_requests
```

3. See what SQL Prisma generated:

```bash
cat prisma/migrations/XXXXXX_add_tags_to_requests/migration.sql
```

**What you'll learn:**
- How schema changes become SQL
- How Prisma generates migration files
- How databases ALTER tables (not drop and recreate!)

**Bonus:** Query with the new field:

```typescript
// In your service
const requests = await prisma.maintenance_request.findMany({
  where: {
    tags: { contains: "urgent" }
  }
});
```

## Summary

**The mental model you now have:**

* **Databases** are persistent storage with tables, rows, and columns
* **Prisma** is an ORM that translates TypeScript to SQL
* **Relations** connect tables via foreign keys (one-to-one, one-to-many, many-to-many)
* **CRUD** operations (Create, Read, Update, Delete) are how you interact with data
* **Indexes** make queries fast by creating lookup tables
* **Constraints** enforce rules (unique, foreign keys, not null)
* **Transactions** ensure multiple operations succeed or fail together

**Key Prisma patterns:**
- **`prisma.model.create()`** - Insert row
- **`prisma.model.findMany()`** - Select with optional WHERE/JOIN
- **`prisma.model.update()`** - Modify row
- **`prisma.model.delete()`** - Remove row
- **`include`** - Eager load relations (avoid N+1 queries)
- **`where`** - Filter results
- **`select`** - Choose specific fields

**Common database concepts:**
- **Primary Key** - Unique ID for each row
- **Foreign Key** - Reference to another table's primary key
- **Index** - Speed up queries (trade write speed for read speed)
- **Cascade** - Automatically delete related records
- **Transaction** - All-or-nothing multi-step operations

**Common pitfalls:**
- N+1 queries (loading relations one-by-one instead of with `include`)
- Missing indexes (slow queries on filtered fields)
- Not using transactions (partial data when one step fails)
- Forgetting `onDelete: Cascade` (orphaned records)

You now understand how your data persists, how relations work, and what SQL Prisma generates for you. Every request that creates, reads, updates, or deletes data is now transparent to you - you understand what's happening under the hood.

---

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]