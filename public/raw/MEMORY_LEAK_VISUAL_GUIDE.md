# Memory Leak Visual Guide - What You Need to See

> A hands-on visual guide to identifying, debugging, and fixing the 7 most common memory leak patterns in React with TypeScript.

---
Type: post
Date: 2026-03-06
Reading time: 6 min read
---

# Memory Leak Visual Guide - What You Need to See

## Quick Summary - The Difference

| **LEAKY Version** | **FIXED Version** |
|-------------------|-------------------|
| Old components stay in memory even after unmount | Components are properly cleaned up |
| Event listeners pile up | Listeners are removed |
| Timers keep running | Timers are cleared |
| Console logs accumulate each mount/unmount | Cleanup functions log "Unsubscribed" |

---

## Step 1: Open the Demo

```bash
cd /home/marwan/coding-tutor-tutorials/memory-leak-demo
pnpm dev
# Opens at http://localhost:3001
```

---

## Step 2: Try the LEAKY Version

### What to do:
1. Click **"Add All Components"** (all 7 components appear)
2. Wait 3 seconds
3. Click **"Remove All"** (components disappear from screen)
4. Click **"Add All Components"** again
5. **Look at the browser console!**

### What you'll see (LEAKY):
```
Handler can access largeData: {chunks: Array...}
Handler can access largeData: {chunks: Array...}
Handler can access largeData: {chunks: Array...}
Handler can access largeData: {chunks: Array...}
```

**Each mount/unmount cycle adds MORE handlers!** They never get removed.

### Why this is bad:
- Even though the component is gone from the screen, it's **still in memory**
- The click handler from the "Leaky Closure" component is STILL active
- Every time you click anywhere on the page, all those old handlers fire
- Memory keeps growing

---

## Step 3: Try the FIXED Version

### What to do:
1. Click **"Switch to Fixed Version"**
2. Click **"Remove All"**
3. **Look at the browser console!**

### What you'll see (FIXED):
```
Unsubscribed from store
```

**The cleanup function ran!** The component properly removed its event listeners, timers, and subscriptions.

### Why this is good:
- Components are fully removed from memory when unmounted
- No listeners pile up
- Memory stays stable

---

## Step 4: See the Code Difference

### Leaky Version (src/leaky-components.tsx):
```tsx
useEffect(() => {
  const handler = () => {
    console.log('Handler can access largeData:', largeData.current)
  }

  window.addEventListener('click', handler)
  // ❌ NO CLEANUP! This listener stays forever
}, [])
```

### Fixed Version (src/fixed-components.tsx):
```tsx
useEffect(() => {
  const handler = () => {
    console.log('Handler can access largeData:', largeData.current)
  }

  window.addEventListener('click', handler)

  // ✅ CLEANUP! Remove listener when component unmounts
  return () => {
    window.removeEventListener('click', handler)
    largeData.current = null  // Also clear the data
  }
}, [])
```

**The only difference is the `return () => {...}` cleanup function!**

---

## Step 5: Chrome DevTools Memory Tab (Optional but Powerful)

To **actually see** the memory difference:

1. Open Chrome DevTools (F12)
2. Go to **Memory** tab
3. Take a **Heap Snapshot** (click camera icon)
4. In the app: Click "Add All" → wait → "Remove All" → "Add All" again
5. Take another snapshot
6. Select the second snapshot
7. Change view from "Summary" to **"Comparison"**
8. Select the first snapshot to compare against

### What to look for:
- **Detached DOM tree** - DOM nodes removed but still in memory
- **EventListener** - Should be low/zero in fixed version
- **Array / Object** - Look for objects with large "Retained Size"
- Click any object and look at **"Retainers"** at bottom to see what's holding it

---

## The 7 Memory Leak Types Demonstrated

| # | Component | The Leak | The Fix |
|---|-----------|----------|---------|
| 1 | Event Listener | `addEventListener` without `removeEventListener` | Return cleanup: `() => window.removeEventListener(...)` |
| 2 | Interval | `setInterval` without `clearInterval` | Return cleanup: `() => clearInterval(id)` |
| 3 | Growing Array | State grows forever | Keep bounded: `if (items.length > 100) items.shift()` |
| 4 | Closure | Handler holds 1MB+ data | Remove listener AND set data to null |
| 5 | Observer | `ResizeObserver` without `disconnect()` | Return cleanup: `() => observer.disconnect()` |
| 6 | Async Operation | State update after unmount | Use `AbortController` or `isMounted` ref |
| 7 | Store Subscription | Subscribe without unsubscribe | Return cleanup: `() => unsubscribe()` |

---

## Key Mental Model

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY LEAK VISUALIZED                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  LEAKY (Bad):                                               │
│  ┌─────────┐   mount   ┌─────────┐   unmount   (invisible) │
│  │ Component│ ──────> │Component│ ────────>  │Component◄─────┤ STILL IN MEMORY!
│  │         │          │         │             │  │           │
│  │ handler │          │ handler │             │  │handler   │
│  └─────────┘          └─────────┘             │  └───────────┘
│                                                  ▲           │
│                                                  │           │
│  Still attached to window object ────────────────┘           │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FIXED (Good):                                              │
│  ┌─────────┐   mount   ┌─────────┐   unmount   GONE        │
│  │ Component│ ──────> │Component│ ────────>  ✅ nothing    │
│  │         │          │         │                          │
│  │ handler │          │ handler │                          │
│  └─────────┘          └─────────┘                          │
│        │                    │                                │
│        │ cleanup            │ cleanup                       │
│        ▼                    ▼                                │
│    removeListener      removeListener                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Checklist for Your Code

Every time you write `useEffect`, ask:

```tsx
useEffect(() => {
  // Did I...
  const listener = addEventListener(...)  // → Must remove in cleanup!
  const timer = setInterval(...)          // → Must clear in cleanup!
  const observer = new ResizeObserver(...) // → Must disconnect in cleanup!
  const sub = store.subscribe(...)        // → Must unsubscribe in cleanup!

  // ✅ ALWAYS RETURN CLEANUP
  return () => {
    removeEventListener(...)
    clearInterval(...)
    observer.disconnect(...)
    sub.unsubscribe()
  }
}, [])
```

---

## Questions to Test Understanding

1. **Why does the leaky version cause console logs to pile up?**
   - Because the click handler is never removed, so each mount adds a NEW one

2. **What does the "Unsubscribed from store" log tell us?**
   - The cleanup function ran properly

3. **Why doesn't the component disappearing from the screen mean it's gone from memory?**
   - JavaScript keeps objects in memory as long as something references them
   - The window object still has a reference to the event listener

4. **How do you verify a memory leak?**
   - Use Chrome DevTools Memory tab
   - Take heap snapshots before and after mount/unmount cycles
   - Use Comparison view to see objects that increased

---

## Files Reference

- **Tutorial**: `/home/marwan/coding-tutor-tutorials/2026-02-18-memory-leaks-debugging-react-typescript.md`
- **Demo App**: `/home/marwan/coding-tutor-tutorials/memory-leak-demo/`
- **Leaky Code**: `memory-leak-demo/src/leaky-components.tsx`
- **Fixed Code**: `memory-leak-demo/src/fixed-components.tsx`