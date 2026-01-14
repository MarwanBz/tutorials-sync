# Controlled vs Uncontrolled Forms: Complete Guide

> Understanding when and how to use controlled vs uncontrolled components in React forms. From the mental model to your actual DatePicker implementation - this is your complete guide to form state management in 2025.

---
Type: post
Date: 2026-01-11
Reading time: 12 min read
Tags: Controlled Components, Uncontrolled Components, React Forms, Formik, State Management, Refs, Form Libraries, React 19 Form Actions
---

# Controlled vs Uncontrolled Forms: Complete Guide

Marwan, you've been building forms with Formik for a while now. You've seen controlled components, uncontrolled components, refs, useState - but do you really understand **when** to use which approach and **why**?

Let's dive deep into this topic, using examples from your actual CRM codebase.

## The Mental Model: Who Owns the Truth?

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONTROLED COMPONENT                         │
│  ┌──────────────┐      value          ┌──────────────┐        │
│  │   React      │ ──────────────────▶│     Input    │        │
│  │   State      │ ◀──────────────────│              │        │
│  └──────────────┘      onChange       └──────────────┘        │
│                                                                 │
│  "React controls everything. The input just displays."          │
│                                                                 │
│  Single source of truth: React state                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   UNCONTROLLED COMPONENT                        │
│  ┌──────────────┐                    ┌──────────────┐        │
│  │     Input    │ ──── when needed ──▶│   React      │        │
│  │              │     (via ref)       │   State      │        │
│  └──────────────┘                    └──────────────┘        │
│                                                                 │
│  "The input manages itself. React reads it when needed."        │
│                                                                 │
│  Source of truth: DOM (accessed via ref)                        │
└─────────────────────────────────────────────────────────────────┘
```

## The Basics: Simple Examples

### Controlled Input

```tsx
function ControlledInput() {
  const [value, setValue] = useState('');

  return (
    <input
      value={value}                           // React sets the value
      onChange={(e) => setValue(e.target.value)}  // React gets changes
    />
  );
}
```

**How it works:**
1. React state (`value`) is the source of truth
2. On every keystroke → `onChange` fires → `setValue` updates state
3. React re-renders with new state → input displays new value
4. **React controls the input value at all times**

### Uncontrolled Input

```tsx
function UncontrolledInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    console.log(inputRef.current?.value);  // Read from DOM when needed
  };

  return (
    <input
      ref={inputRef}                         // Let the input manage itself
      defaultValue="initial"                 // Set initial value only
    />
  );
}
```

**How it works:**
1. Input manages its own value internally (DOM state)
2. `defaultValue` sets the initial value only
3. When you need the value → read via `ref.current.value`
4. **The input controls itself, React just reads it**

## Your Codebase: Real Examples

Let's look at your actual components and understand the patterns.

### Pattern 1: Base Component - Can Be Either

**File:** `components/AppInput/index.tsx`

```tsx
const AppInput = forwardRef<HTMLInputElement, AppInputProps>(
  ({ value, onChange, ...props }, ref) => {
    return (
      <input
        ref={ref}              // Pass ref through - allows uncontrolled usage
        value={value}          // Accept value - allows controlled usage
        onChange={onChange}    // Accept onChange - allows controlled usage
        {...props}
      />
    );
  }
);
```

**This is smart design:**
- Base component doesn't care about control method
- Accepts both `ref` (uncontrolled) AND `value`/`onChange` (controlled)
- Let's the parent decide the pattern

**Usage - Controlled:**
```tsx
function MyForm() {
  const [name, setName] = useState('');
  return <AppInput value={name} onChange={e => setName(e.target.value)} />;
}
```

**Usage - Uncontrolled:**
```tsx
function MyForm() {
  const nameRef = useRef<HTMLInputElement>(null);
  const handleSubmit = () => {
    console.log(nameRef.current?.value);
  };
  return <AppInput ref={nameRef} defaultValue="initial" />;
}
```

### Pattern 2: Controlled Wrapper (Formik)

**File:** `components/AppFormikInput/index.tsx`

```tsx
const AppFormikInput = (props: FormikInputProps) => {
  // Formik hook - makes the component controlled by Formik state
  const [field, meta, helpers] = useField(props.name);

  return (
    <AppInput
      {...field}                          // value, onChange, onBlur from Formik
      error={meta.touched && meta.error}  // Validation state
      {...props}
    />
  );
};
```

**What happens here:**
1. `useField` connects the input to Formik's state
2. Formik becomes the source of truth
3. The wrapper handles validation state (`touched`, `error`)
4. The base `AppInput` just receives `value` and `onChange`

### Pattern 3: Your New DatePicker - Pure Controlled

**File:** `components/ui/date-picker.tsx`

```tsx
export function DatePicker({ value, onChange, label, error }: DatePickerProps) {
  // ✅ No local state! Pure controlled component.

  return (
    <Popover>
      <PopoverTrigger>
        <button>
          {value ? format(value, 'yyyy/MM/dd') : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar
          selected={value}       // Direct prop - controlled
          onSelect={onChange}    // Direct callback - controlled
          month={value}          // Show selected month
        />
      </PopoverContent>
    </Popover>
  );
}
```

**Why this is clean:**
- **No local state** → no sync bugs
- **No `useEffect`** → simpler logic
- **Pure controlled** → predictable behavior

### Comparison: Old vs New DatePicker

**Old:** `components/date-picker.tsx` (still exists, other files use it)

```tsx
// ❌ Had complex sync logic
const [selected, setSelected] = useState(value);

useEffect(() => {
  // Complex sync logic to handle value prop changes
  if (value instanceof Date && selected instanceof Date) {
    if (value.getTime() !== selected.getTime()) {
      setSelected(value);
    }
  }
}, [value]);
```

**New:** `components/ui/date-picker.tsx` (your task form uses this)

```tsx
// ✅ Pure controlled - no sync needed
<Calendar
  selected={value}
  onSelect={onChange}
/>
```

| Aspect | Old | New |
|--------|-----|-----|
| State | Local `useState` | None (controlled) |
| Sync | Complex `useEffect` | Not needed |
| Lines | ~130 | ~65 |
| Predictability | Medium (sync bugs possible) | High |

## When to Use Which?

### Decision Flowchart

```
                    Start
                      │
                      ▼
           Does the form have field dependencies?
                      │
        ┌─────────────┴─────────────┐
        │ Yes                       │ No
        ▼                           ▼
  Do you need real-time    Is performance critical?
  validation or formatting?
        │                   │
        ▼                   ▼
  Use Controlled    Is it a simple form?
                      │
          ┌───────────┴───────────┐
          │ Yes                   │ No
          ▼                       ▼
    Use Uncontrolled      Use Controlled
    or React 19 Actions   (for predictability)
```

### Use Controlled When:

✅ **Field dependencies** - "Show field B only when field A has value"
✅ **Real-time validation** - "Password strength indicator"
✅ **Input formatting** - "Phone number: (123) 456-7890"
✅ **Dynamic forms** - "Add/remove fields based on user actions"
✅ **Using Formik/react-hook-form** - These libraries use controlled patterns

**Example from your codebase:**

**File:** `app/(app)/tasks/_components/task-form.tsx`

```tsx
<DatePicker
  value={values.due_date}              // Formik state
  onChange={(date) => setFieldValue('due_date', date)}  // Update Formik
  error={touched.due_date ? errors.due_date : undefined}
/>
```

This is controlled because:
- Formik owns the state (`values.due_date`)
- Parent controls the DatePicker via props
- Validation is immediate (when form is submitted)

### Use Uncontrolled When:

✅ **Simple forms** - Login, contact, feedback (no field dependencies)
✅ **Performance critical** - Large forms (20+ fields)
✅ **Legacy integration** - Working with jQuery plugins, non-React code
✅ **On-submit only** - Only need values when user clicks submit
✅ **React 19+** - Using form actions

## Form Libraries: The Best of Both Worlds

Your codebase uses **Formik** - which gives you controlled-like API with optimized performance.

### How Formik Works

```tsx
<Formik
  initialValues={{ name: '', email: '' }}
  onSubmit={(values) => console.log(values)}
>
  {({ values, handleChange, handleSubmit }) => (
    <form onSubmit={handleSubmit}>
      <input
        name="name"
        value={values.name}           // Controlled by Formik state
        onChange={handleChange}      // Updates Formik state
      />
      <button type="submit">Submit</button>
    </form>
  )}
</Formik>
```

**What Formik gives you:**
1. **Single source of truth** - Formik manages all form state
2. **Validation** - Integrated with Yup/Zod
3. **Error handling** - `touched`, `errors` automatically managed
4. **Performance** - Only re-renders when necessary (not on every keystroke)

### Your Task Form: Complete Data Flow

```tsx
// app/(app)/tasks/_components/task-form.tsx
<Formik
  initialValues={{
    due_date: initialValues?.due_date
      ? new Date(initialValues.due_date)  // Convert API string → Date
      : undefined,
  }}
  onSubmit={(values) => {
    // values.due_date is Date | undefined
    onSubmit({
      ...values,
      due_date: moment(values.due_date).format('YYYY-MM-DD'),  // Date → string for API
    });
  }}
>
  {({ values, setFieldValue, touched, errors }) => (
    <DatePicker
      value={values.due_date}              // Date | undefined
      onChange={(date) => setFieldValue('due_date', date)}
      error={touched.due_date ? errors.due_date : undefined}
    />
  )}
</Formik>
```

**Data flow:**

```
┌─────────────────┐
│  API (string)   │  "2024-01-15"
└────────┬────────┘
         │ Formik initialValues
         ▼ Convert: new Date()
┌─────────────────┐
│ Formik (Date)   │  Date object - source of truth
└────────┬────────┘
         │ Pass to DatePicker
         ▼
┌─────────────────┐
│  DatePicker     │  Controlled component (no local state)
└────────┬────────┘
         │ User selects date
         ▼
┌─────────────────┐
│   Calendar      │  shadcn component
└────────┬────────┘
         │ onSelect callback
         ▼
┌─────────────────┐
│ Formik update   │  setFieldValue('due_date', date)
└────────┬────────┘
         │ User submits
         ▼ Format: moment().format()
┌─────────────────┐
│  API (string)   │  "2024-01-15"
└─────────────────┘
```

## Best Practices from Your Codebase

### 1. Layered Architecture

Your codebase demonstrates excellent separation:

```
┌─────────────────────────────────────────────────────────┐
│                    Form Libraries                        │
│         (Formik, Yup, Zod, react-hook-form)              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Controlled Wrapper Components                │
│     (AppFormikInput, AppFormikDropdown, DatePicker)      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Base UI Components                      │
│        (AppInput, AppDropdown, Calendar)                 │
└─────────────────────────────────────────────────────────┘
```

**Why this is good:**
- Base components are reusable in any context
- Wrapper components add form library integration
- Clear separation of concerns

### 2. Consistent Error Handling

Your forms show errors only after the user has touched the field:

```tsx
error={touched.due_date ? errors.due_date : undefined}
```

**Why this matters:**
- Don't show errors before user interacts
- Better UX - less overwhelming
- Standard pattern in Formik

### 3. Type Conversion at Boundaries

You convert between types at the API/Formik boundary:

```tsx
// API → Formik: string → Date
initialValues={{
  due_date: initialValues?.due_date ? new Date(initialValues.due_date) : undefined,
}}

// Formik → API: Date → string
onSubmit={(values) => {
  onSubmit({
    due_date: moment(values.due_date).format('YYYY-MM-DD'),
  });
}}
```

**Why this is clean:**
- Formik works with native Date objects
- API gets the format it expects
- Conversion happens at predictable boundaries

## Common Mistakes to Avoid

### Mistake 1: Mixing Controlled and Uncontrolled

❌ **Don't do this:**

```tsx
function BadForm() {
  const [name, setName] = useState('');  // Controlled
  const emailRef = useRef<HTMLInputElement>(null);  // Uncontrolled

  return (
    <form>
      <input value={name} onChange={e => setName(e.target.value)} />
      <input ref={emailRef} />
    </form>
  );
}
```

**Why it's bad:**
- Inconsistent mental model
- Harder to maintain
- Confusing for other developers

### Mistake 2: Unnecessary State in Controlled Components

❌ **Don't do this:**

```tsx
function UnnecessaryState({ value, onChange }) {
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return <input value={internalValue} onChange={e => {
    setInternalValue(e.target.value);
    onChange(e.target.value);
  }} />;
}
```

**Why it's bad:**
- Duplicate state (component + parent)
- `useEffect` just to sync - wasteful
- Can cause bugs if sync is off

✅ **Do this instead:**

```tsx
function PureControlled({ value, onChange }) {
  return <input value={value} onChange={onChange} />;
}
```

### Mistake 3: Over-Optimizing Prematurely

From [Dev.to (Dec 2025)](https://dev.to/maximongunov/controlled-vs-uncontrolled-components-in-react-a-practical-guide-k79):

> "Start with controlled for better developer experience, optimize to uncontrolled only if you measure a performance problem."

**Translation:** Don't use uncontrolled for performance until you actually have a performance problem.

## React 19+ Form Actions

React 19 introduced a new way to handle forms:

```tsx
function UpdateName() {
  const [state, formAction] = useFormState(async (prevState, formData) => {
    const name = formData.get('name');
    await updateName(name);
    return { success: true };
  }, null);

  return (
    <form action={formAction}>
      <input name="name" />
      <button type="submit">Update</button>
    </form>
  );
}
```

**Benefits:**
- No state management needed
- Works without JavaScript (progressive enhancement)
- Simpler for basic forms

**When to consider:**
- Simple server-submitted forms
- When you want progressive enhancement
- Not yet widely adopted in your codebase

## Comparison: Complete Reference

| Aspect | Controlled | Uncontrolled |
|--------|-----------|--------------|
| **Data Source** | React state | DOM (via ref) |
| **Re-renders** | On every keystroke | Only when you trigger |
| **Validation** | Real-time | On submit/blur |
| **Boilerplate** | More (state per field) | Less (refs) |
| **Performance** | Good for most forms | Better for large forms |
| **Predictability** | High (state = truth) | Lower (DOM = truth) |
| **Testing** | Easier (test state) | Harder (need DOM) |
| **Conditional Fields** | Easy | Harder |
| **Input Formatting** | Easy | Harder |
| **Dependencies** | Easy (useEffect) | Manual |
| **Learning Curve** | Moderate | Easy |
| **Your Codebase** | Formik, DatePicker | AppInput (base) |

## Try It Yourself

Here are exercises for your CRM codebase:

### Exercise 1: Add Date Validation

<details>
<summary>Add validation to ensure due_date is in the future</summary>

Update `task-form.tsx` validation:

```tsx
due_date: yup
  .mixed()
  .test('required', 'التاريخ مطلوب', (value) => value != null && value !== '')
  .test(
    'future',
    'التاريخ يجب أن يكون في المستقبل',
    (value) => {
      if (!value) return true;
      const date = value instanceof Date ? value : new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date >= today;
    }
  )
```

</details>

### Exercise 2: Convert a Form to React 19 Actions

<details>
<summary>Try creating a simple form using React 19 form actions</summary>

Create a new component:

```tsx
'use client';

import { useFormState } from 'react-dom';

function SimpleContactForm() {
  const [state, formAction] = useFormState(async (prevState, formData) => {
    // This runs on the server (if using Next.js server actions)
    // or client-side (if using regular functions)
    const name = formData.get('name');
    const email = formData.get('email');
    const message = formData.get('message');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true, message: 'Thanks for contacting us!' };
  }, null);

  return (
    <form action={formAction}>
      <input name="name" placeholder="Your name" required />
      <input name="email" type="email" placeholder="Your email" required />
      <textarea name="message" placeholder="Your message" required />
      <button type="submit">Send Message</button>
      {state?.message && <p>{state.message}</p>}
    </form>
  );
}
```

</details>

### Exercise 3: Audit Your Forms

<details>
<summary>Review all forms in your CRM and identify patterns</summary>

Go through these files and identify each as controlled/uncontrolled:

1. `app/(app)/tasks/_components/task-form.tsx`
2. `app/(app)/clients/_components/create-engagement-stepper.tsx`
3. `app/(app)/projects/_components/project-form.tsx`

For each form:
- What pattern does it use?
- Is it the right choice for that use case?
- Are there any inconsistencies (mixed patterns)?

</details>

## Key Takeaways

1. **Controlled = React owns state** (via `value` + `onChange`)
2. **Uncontrolled = DOM owns state** (via `ref` + `defaultValue`)
3. **Your codebase uses both wisely** - base components are flexible, wrappers are controlled
4. **Default to controlled** for most cases - more predictable and testable
5. **Formik gives you the best of both** - controlled API with optimized performance
6. **Your new DatePicker is a great example** - pure controlled, no sync issues
7. **Be consistent** within a form - don't mix patterns
8. **Don't over-optimize** - start controlled, optimize only if needed

## Further Reading

### 2025 Resources

- [Dev.to: Controlled vs. Uncontrolled - A Practical Guide](https://dev.to/maximongunov/controlled-vs-uncontrolled-components-in-react-a-practical-guide-k79) (Dec 8, 2025)
- [JavaScript Plain English: The Easiest Guide](https://javascript.plainenglish.io/controlled-vs-uncontrolled-components-react-the-easiest-guide-youll-ever-read-65154b6987b5) (Nov 29, 2025)
- [NashTech Global: Form Handling Best Practices](https://blog.nashtechglobal.com/react-form-handling-controlled-vs-uncontrolled-components/) (Apr 30, 2025)
- [YouTube: React Controlled vs Uncontrolled](https://www.youtube.com/watch?v=QuigstiCUuc)

### Authoritative Sources

- [React Documentation: Forms](https://react.dev/learn/synchronizing-with-effects)
- [TkDodo Blog: React Query & Form Patterns](https://tkdodo.eu/blog/)

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]