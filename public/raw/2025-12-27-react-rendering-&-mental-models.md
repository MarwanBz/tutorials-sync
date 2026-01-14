# React Rendering & Mental Models

> Understanding how React decides what to re-render, why components update unexpectedly, and how to think about rendering like a senior engineer.

---
Type: post
Date: 2025-12-27
Reading time: 8 min read
Tags: React Rendering, Reconciliation, Memoization, React Mental Model
---

# React Rendering & Mental Models

You've been using React for a while now. You know how to build components, manage state, and fetch data. But have you ever wondered: *why does my component re-render?* or *why is this so slow?*

This is the difference between someone who *uses* React and someone who *understands* React. Senior engineers don't just write code that works—they write code that works *efficiently* because they understand what's happening under the hood.

Let's dive into React's rendering model and change how you think about React forever.

## The Problem: Unnecessary Renders

Here's something that might surprise you. In your `haseen` project, you have a `useScroll` hook at `src/hooks/use-scroll.ts:1-28`:

```tsx
function useScroll() {
  const [scrollPosition, setScrollPosition] = useState({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition({
        x: window.scrollX,
        y: window.scrollY,
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrollPosition;
}
```

And you use it in your `LanguageSwitcher` component at `src/components/language-switcher.tsx:16`:

```tsx
export function LanguageSwitcher() {
  const { y } = useScroll();  // ← This triggers a re-render on EVERY scroll!
  const scrolled = y > 80;
  // ... rest of component
}
```

**Every single time the user scrolls, React re-renders your entire `LanguageSwitcher` component.** A user might scroll 100 times in a minute—that's 100 unnecessary re-renders for a component that just needs to know "are we past 80px?"

This is the kind of problem that makes apps feel sluggish. But to fix it, you need to understand *why* it's happening.

## What Actually Happens When You Call `setState`?

Here's the mental model you need: **React components are functions. The UI you see is the *result* of calling that function.**

When you do:
```tsx
const [count, setCount] = useState(0);
```

You're telling React: "Hey, every time `count` changes, I want you to call my component function again with the new value."

Think of it like this:

```
┌─────────────────────────────────────────────────────────┐
│                    React's Render Cycle                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Something changes (state, props, context)           │
│         ↓                                                │
│  2. React marks component as "needs update"             │
│         ↓                                                │
│  3. React calls your component function                 │
│         ↓                                                │
│  4. React compares the result with what's on screen      │
│         ↓                                                │
│  5. React updates only what changed (DOM)                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

The key insight: **Steps 3-5 happen on EVERY state change.** Even if the value only changed a tiny bit.

## Reconciliation: How React Decides What to Update

After React calls your component function, it gets back a description of what the UI *should* look like (this is called "virtual DOM"). Then it compares this to what's currently on screen.

This comparison process is called **reconciliation**. Here's the algorithm in simple terms:

1. **If element types are different:** Destroy the old one, create the new one
   ```tsx
   // Before: <button />
   // After:  <div />
   // React: "Throw away button, create div"
   ```

2. **If element types are the same:** Update the attributes
   ```tsx
   // Before: <button className="btn" />
   // After:  <button className="btn active" />
   // React: "Keep button, just change className"
   ```

3. **If children are different:** Use `key` prop to match them up
   ```tsx
   {items.map(item => <li key={item.id}>{item.name}</li>)}
   // Without key: React destroys all <li> and recreates
   // With key: React reuses existing <li> elements
   ```

This is why keys matter so much in lists. They tell React "this element is the SAME as before, just with new data."

## Why Your `useScroll` Causes Problems

Now you can see why `LanguageSwitcher` re-renders so much:

1. User scrolls → `handleScroll` fires
2. `setScrollPosition({ x: new, y: new })` is called
3. React marks `useScroll` as needing update
4. `useScroll` returns new values → triggers `LanguageSwitcher` update
5. React calls `LanguageSwitcher()` again
6. Reconciliation runs, DOM updates

**On every single scroll event.**

The fix? Move the scrolled check *inside* the hook, and only notify listeners when the threshold is crossed:

```tsx
function useScrolled(threshold: number = 80) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const shouldShow = window.scrollY > threshold;
      setIsScrolled(shouldShow);  // Only updates when value actually changes
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return isScrolled;
}
```

Now your component only re-renders when `isScrolled` actually changes from `false` to `true` or vice versa—not on every pixel of scroll.

## When React Skips Renders: Referential Equality

Here's something that trips up even experienced developers. Look at your `BlogTracker` component at `src/components/blog/BlogTracker.tsx:17`:

```tsx
useEffect(() => {
  trackBlogView(blogTitle, category, readingTime);
  // ...
}, [blogTitle, category, readingTime]);
```

Why does `useEffect` need that dependency array? Because React uses **referential equality** to decide if values changed.

For primitives (strings, numbers, booleans):
```tsx
"hello" === "hello"  // ✅ true - same value
42 === 42           // ✅ true
```

For objects and arrays:
```tsx
{ name: "Marwan" } === { name: "Marwan" }  // ❌ false - different references!
[1, 2, 3] === [1, 2, 3]                    // ❌ false - different references!
```

This is why passing a *new* object/array as a prop causes unnecessary renders:

```tsx
// BAD - Creates new object every render
<Component data={{ name: "Marwan" }} />

// GOOD - Object created once, reused
const data = { name: "Marwan" };
<Component data={data} />
```

This is also where `useMemo` and `useCallback` come in—they're not about "making things faster," they're about **preserving referential equality** to prevent unnecessary renders.

## Server Components vs Client Components

Your `haseen` project uses Next.js 15 with the App Router. You have both server and client components:

**Server Component** - `RelatedBlogCard` at `src/components/blog/RelatedBlogCard.tsx:22`:
```tsx
// No "use client" directive
export default function RelatedBlogCard({ data, filePath }) {
  // This runs on the server, zero JavaScript shipped to browser
  return <div>...</div>
}
```

**Client Component** - `LanguageSwitcher` at `src/components/language-switcher.tsx:1`:
```tsx
"use client";  // ← Enables React hooks and interactivity

export function LanguageSwitcher() {
  const [currentLanguage, setCurrentLanguage] = useState(...);
  // ...
}
```

**The mental model:** Server components are like pure HTML generators. They can't use hooks or handle events because they run once at build/request time and send HTML to the browser. Client components are full React apps—they can re-render, handle events, use hooks.

This is the future of React: **render as much as possible on the server, only use client components when you need interactivity.**

## Common Pitfalls

### 1. Deriving State in `useEffect`

```tsx
// BAD - Extra render cycle
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// GOOD - Derived during render
const fullName = `${firstName} ${lastName}`;
```

### 2. Creating Functions in Render

```tsx
// BAD - New function every render
<Component onClick={() => handleClick(id)} />

// GOOD - Stable reference
const handleClick = useCallback(() => {
  // do something with id
}, [id]);
```

### 3. Not Using Keys Properly

```tsx
// BAD - Array index as key
{items.map((item, index) => <Card key={index} />)}

// GOOD - Stable unique id
{items.map(item => <Card key={item.id} />)}
```

## Try It Yourself

Here's a challenge for you in your `haseen` project:

1. **Optimize `useScroll`**: Modify `src/hooks/use-scroll.ts` to return a boolean `isScrolled` instead of raw coordinates. Update `LanguageSwitcher` to use this optimized version.

2. **Add React DevTools**: Install the React DevTools browser extension and use the Profiler to see which components are rendering. Try scrolling on your blog page and watch the flame graph.

3. **Test the difference**: Before and after your changes, count how many times `LanguageSwitcher` renders during a single page scroll. You should see a dramatic reduction.

---

## Summary

* **React components are functions**—rendering is calling that function with new data
* **Reconciliation** is how React compares the new virtual DOM with the old one and minimizes DOM updates
* **State changes trigger renders**—every `setState` means your component function runs again
* **Referential equality matters**—objects/arrays with same values are considered different if they're different references
* **Memoization (`useMemo`, `useCallback`)** is about preserving reference stability, not "optimization"
* **Server components** run once and send HTML; **client components** can re-render and handle events

The key insight: **You don't optimize by adding tools. You optimize by understanding the system well enough to avoid problems in the first place.**

---

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]