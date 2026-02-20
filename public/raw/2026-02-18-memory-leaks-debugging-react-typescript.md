# Memory Leaks in React TypeScript

> Understanding memory leaks in React TypeScript applications - how they happen, how to debug them using Chrome DevTools, and how to fix them. Includes hands-on demo app.

---
Type: post
Date: 2026-02-18
Reading time: 11 min read
Tags: Memory Leaks, React useEffect Cleanup, Chrome DevTools, Heap Snapshots, Event Listeners, JavaScript Garbage Collection, Performance Debugging
---

# Memory Leaks in React TypeScript

You've built a React app. It works great. But after using it for a while, things start slowing down. The browser becomes sluggish. Maybe it even crashes.

You've got a **memory leak**.

This tutorial will transform you from someone who "hopes their app doesn't leak" into someone who can **systematically find and fix memory leaks**. We'll dig deep into JavaScript's memory model, React's lifecycle, and Chrome DevTools' powerful debugging capabilities.

---

## The Mental Model: How JavaScript Memory Works

Before fixing leaks, you need to understand how JavaScript manages memory. Here's the foundation:

### The Garbage Collector (GC)

JavaScript is **garbage collected**. This means you don't manually malloc/free like in C. Instead, the GC automatically reclaims memory that's no longer being used.

**The key rule:** Memory is freed when it's no longer *reachable*.

```javascript
// This object CAN be garbage collected
function example() {
  const data = { huge: 'array' }
  // data goes out of scope when function ends
  // No references remain → GC can free it
}

// This object CANNOT be garbage collected
let globalRef
function example() {
  const data = { huge: 'array' }
  globalRef = data  // ← Still reachable!
  // GC cannot free this memory
}
```

### Retainers and References

When debugging memory, you'll constantly see the term **"retainers"**. A retainer is something that's holding onto a reference, preventing garbage collection.

Think of it like a tree:
```
GC Root (window, global, etc.)
  └─→ yourComponent
       └─→ eventListener
            └─→ componentState (huge object)
```

As long as a path exists from a GC Root to your object, it stays in memory. Break all paths, and GC collects it.

### Why This Matters in React

React components mount and unmount. When a component unmounts, you want **everything** related to it to be garbage collected. But React doesn't magically do this—you need to clean up after yourself.

---

## The Seven Deadly Memory Leaks

Let's walk through each common leak pattern. You'll find working examples in the demo app at `memory-leak-demo/`.

### 1. Event Listeners Never Removed

```tsx
// ❌ LEAK
useEffect(() => {
  const handler = () => setState(window.scrollY)
  window.addEventListener('scroll', handler)
  // Missing cleanup function!
}, [])

// ✅ FIXED
useEffect(() => {
  const handler = () => setState(window.scrollY)
  window.addEventListener('scroll', handler)

  return () => {
    window.removeEventListener('scroll', handler)
  }
}, [])
```

**Why it leaks:** The listener stays attached to `window` even after your component unmounts. Every time the component mounts, a NEW listener is added. They accumulate.

**How to spot it:** In a heap snapshot, look for increasing numbers of event listeners or "Detached DOM nodes" that are held by event listeners.

### 2. setInterval/clearInterval Not Cleared

```tsx
// ❌ LEAK
useEffect(() => {
  const id = setInterval(() => setState(s => s + 1), 1000)
  // Missing cleanup
}, [])

// ✅ FIXED
useEffect(() => {
  const id = setInterval(() => setState(s => s + 1), 1000)
  return () => clearInterval(id)
}, [])
```

**Why it leaks:** The interval continues firing after unmount. Each call to `setState` keeps the component's state in memory. The closure captures all component variables.

**How to spot it:** Heap snapshots show increasing timer objects. The component's state never gets garbage collected because the timer callback holds references.

### 3. Growing State Arrays

```tsx
// ❌ LEAK - State grows forever
const [items, setItems] = useState<string[]>([])

useEffect(() => {
  const interval = setInterval(() => {
    setItems(prev => [...prev, `Item ${prev.length}`])  // Always growing!
  }, 100)
}, [])

// ✅ FIXED - Bounded state
useEffect(() => {
  const interval = setInterval(() => {
    setItems(prev => {
      const newItems = [...prev, `Item ${prev.length}`]
      return newItems.length > 100 ? newItems.slice(1) : newItems  // Keep last 100
    })
  }, 100)
  return () => clearInterval(interval)
}, [])
```

**Why it leaks:** Unbounded state growth. Even if you navigate away, the component stays in memory until GC runs, but the array keeps growing.

**How to spot it:** Watch the JS Heap size in DevTools Performance Monitor. Memory climbs steadily and never drops.

### 4. Closures Capturing Large Data

```tsx
// ❌ LEAK - Closure holds 1MB+ of data
useEffect(() => {
  const largeData = generateHugeObject()  // 1MB+

  const handler = () => {
    console.log(largeData)  // Closure captures largeData
  }

  window.addEventListener('click', handler)
  // Even if we remove the listener, largeData might be held by other closures
}, [])
```

**Why it leaks:** The event handler's closure captures `largeData`. As long as the listener exists, `largeData` can't be garbage collected.

**How to spot it:** In heap snapshot Comparison view, look for objects with large "Retained Size." The "Retainers" section will show the chain of references keeping it alive.

### 5. Observers (ResizeObserver, MutationObserver) Not Disconnected

```tsx
// ❌ LEAK
useEffect(() => {
  const observer = new ResizeObserver(callback)
  observer.observe(elementRef.current)
  // Missing observer.disconnect()
}, [])

// ✅ FIXED
useEffect(() => {
  const observer = new ResizeObserver(callback)
  observer.observe(elementRef.current)

  return () => {
    observer.disconnect()  // Critical!
  }
}, [])
```

**Why it leaks:** Similar to event listeners—observers hold references to both the element and the callback.

### 6. Async Operations After Unmount

```tsx
// ❌ LEAK - State update after unmount
useEffect(() => {
  fetch('/api/data').then(res => res.json()).then(data => {
    setData(data)  // Component might be unmounted!
  })
}, [])

// ✅ FIXED - AbortController pattern
useEffect(() => {
  const controller = new AbortController()

  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(data => {
      if (!controller.signal.aborted) {
        setData(data)
      }
    })

  return () => {
    controller.abort()
  }
}, [])
```

**Why it leaks:** The promise holds references to component state. When it resolves after unmount, those references prevent garbage collection. You also get React warnings about setState on unmounted components.

**Alternative pattern - Mounted Ref:**

```tsx
function useIsMounted() {
  const isMounted = useRef(true)

  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

  return isMounted
}

// Usage
const isMounted = useIsMounted()

useEffect(() => {
  fetchData().then(data => {
    if (isMounted.current) {  // Only update if mounted
      setData(data)
    }
  })
}, [])
```

### 7. Store Subscriptions Without Unsubscribe

```tsx
// ❌ LEAK
useEffect(() => {
  const unsubscribe = store.subscribe(callback)
  // Never calling unsubscribe!
}, [])

// ✅ FIXED
useEffect(() => {
  const unsubscribe = store.subscribe(callback)
  return unsubscribe  // Call cleanup function
}, [])
```

**Why it leaks:** The store holds a reference to your callback. Your callback captures component scope. Chain of retention prevents GC.

---

## Debugging Memory Leaks: The Chrome DevTools Workflow

This is where the rubber meets the road. Let's walk through the exact workflow.

### Step 1: Enable Memory Tab (if needed)

1. Open DevTools (F12 or Cmd+Option+I)
2. Click the ⋮ menu → Settings → Experiments
3. Check "Heap snapshot" and "Allocation profiling" if available

### Step 2: Take Baseline Snapshot

1. Navigate to your app
2. Open DevTools → **Memory** tab
3. Select **"Heap snapshot"**
4. Click the camera icon 📷
5. This is your baseline - memory state at idle

### Step 3: Trigger the Leak

In the demo app:
1. Click **"Add All Components"**
2. Wait 5 seconds
3. Click **"Remove All"**
4. Click **"Add All Components"** again
5. Wait 5 seconds

### Step 4: Take Comparison Snapshot

1. Take another heap snapshot
2. In the dropdown above the snapshot, select **"Comparison"**
3. Select your baseline snapshot to compare against

### Step 5: Analyze the Results

Look for objects that increased:

| Object Type | What It Means |
|-------------|---------------|
| `Detached DOM tree` | DOM nodes removed from page but held in memory |
| `EventListener` | Listeners not removed (useful!) |
| `Array` / `Object` | Growing state, closures |
| `Timers` | `setTimeout`/`setInterval` not cleared |

### Step 6: Drill Down with Retainers

Click any object with increased count. Look at the **"Retainers"** section at the bottom:

```
Object @12345
  └─→ Retainer #1: EventListener
       └─→ Retainer #2: Window
            └─→ GC Root
```

This tells you the **exact chain** keeping your object in memory. Follow it to find the leak source.

### Step 7: Allocation Sampling (Real-Time Monitoring)

For ongoing leaks, use **Allocation Sampling**:

1. In Memory tab, select **"Allocation sampling"**
2. Click Start
3. Use your app normally
4. Click Stop after a minute

This shows you **which functions are allocating memory**. Look for your component names or functions repeatedly allocating without freeing.

---

## Hands-On Exercise: Find the Leak

In the demo app (`memory-leak-demo/`), I've created 7 different components—each with a specific memory leak pattern.

Your mission:

1. **Install and run the demo:**
   ```bash
   cd memory-leak-demo
   pnpm install
   pnpm dev
   ```

2. **Reproduce the leak:**
   - Click "Add All Components"
   - Click "Remove All"
   - Click "Add All Components" again
   - Take a heap snapshot

3. **Find the leaks:**
   - Use Comparison view against baseline
   - Identify which objects increased
   - Use Retainers to trace back to the source

4. **Verify your fix:**
   - Click "Switch to Fixed Version"
   - Do the same mount/unmount cycle
   - Take another snapshot
   - Compare - you should see dramatically fewer retained objects

---

## Pro Tips: Memory Leak Prevention

### 1. The useEffect Checklist

Every time you write `useEffect`, ask yourself:

- [ ] Did I add an event listener? → Must remove it
- [ ] Did I start a timer? → Must clear it
- [ ] Did I create an observer? → Must disconnect it
- [ ] Did I subscribe to something? → Must unsubscribe
- [ ] Did I start an async operation? → Must cancel or check mounted state

### 2. ESLint Rules

Enable the exhaustive-deps rule to catch missing cleanup dependencies:

```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "error"
  }
}
```

### 3. Custom Hooks for Reusable Patterns

```tsx
// useEventListener - always cleans up
function useEventListener<K extends keyof WindowEventMap>(
  event: K,
  handler: (e: WindowEventMap[K]) => void
) {
  useEffect(() => {
    window.addEventListener(event, handler)
    return () => window.removeEventListener(event, handler)
  }, [event, handler])
}

// useInterval - always clears
function useInterval(callback: () => void, delay: number | null) {
  useEffect(() => {
    if (delay === null) return
    const id = setInterval(callback, delay)
    return () => clearInterval(id)
  }, [callback, delay])
}
```

### 4. Performance Monitor DevTool

Add to your browser for real-time memory monitoring:

```
chrome://flags → #enable-devtools-experiments
DevTools Settings → Experiments → Performance Monitor
```

Shows FPS, JS Heap size, DOM Nodes in real-time.

---

## The Debugging Mindset

When you suspect a memory leak, think through it systematically:

1. **Is memory actually growing?**
   - Use Performance Monitor
   - If heap size plateaus, maybe it's just normal GC behavior

2. **When does it grow?**
   - On mount/unmount? → Check useEffect cleanup
   - During interaction? → Check event handlers
   - Over time? → Check growing state/caches

3. **What's being retained?**
   - Take heap snapshot
   - Look for Detached DOM trees
   - Check Retainers chain

4. **Where's the reference?**
   - Retainers show the path to GC Root
   - Follow it backward to find the source
   - The last link in the chain is usually where to fix

---

## Summary

| Concept | Key Takeaway |
|---------|--------------|
| **GC Basics** | Memory is freed when unreachable from GC Roots |
| **Retainers** | The chain of references keeping objects alive |
| **useEffect Cleanup** | Always return a cleanup function for side effects |
| **Heap Snapshots** | Compare snapshots to find growing objects |
| **Retainers View** | Shows exactly what's holding your object in memory |
| **Detached DOM** | DOM nodes removed but still referenced = leak |
| **Comparison View** | Best way to spot leaks over time |

Memory leaks don't have to be scary. With the right mental model and tools, you can systematically find and fix them.

**The key insight:** React doesn't magically clean up after you. The cleanup function in `useEffect` isn't optional—it's the contract you make with React for managing resources.

---

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]