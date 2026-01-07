# Testing Documentation

## Test Setup

NAMM uses **Vitest** as the test runner with **React Testing Library** for component testing.

### Test Infrastructure

- **Test Runner**: Vitest 4.0.16
- **React Testing**: @testing-library/react 16.3.1
- **DOM Testing**: @testing-library/jest-dom 6.9.1
- **User Interactions**: @testing-library/user-event 14.6.1
- **Environment**: jsdom 27.4.0
- **Coverage**: @vitest/coverage-v8 4.0.16

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-run on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Open Vitest UI
npm run test:ui
```

## Test Organization

Tests are colocated with source files in `__tests__` directories:

```
src/
├── hooks/
│   ├── __tests__/
│   │   └── useSettings.test.ts
│   └── useSettings.ts
├── lib/
│   ├── __tests__/
│   │   ├── settings.test.ts
│   │   └── export.test.ts
│   ├── settings.ts
│   └── export.ts
└── test/
    └── setup.ts  # Global test configuration
```

## Test Coverage

### ✅ Currently Tested

**Hooks** (4 tests)
- `useSettings` - Settings hook with live updates
  - Returns current settings on mount
  - Updates when settings change via custom event
  - Cleans up event listeners on unmount
  - Reflects multiple setting changes

**Libraries** (11 tests)
- `settings.ts` - Settings management
  - Returns default settings when localStorage is empty
  - Merges stored settings with defaults
  - Handles invalid JSON gracefully
  - Updates partial settings
  - Dispatches settings-changed events
  - Preserves existing settings when updating
  - Validates AppSettings interface
  - Validates connectionType values
  - Validates defaultMapLayer values

- `export.ts` - Data export utilities
  - exportToJSON callable with data and filename
  - exportToCSV callable with array data and filename

### 🚧 To Be Tested

**Priority: High**
- [ ] `useNodes` - Node data fetching hook
- [ ] `useMessages` - Message data fetching hook
- [ ] `useRealTimeEvents` - SSE real-time events hook
- [ ] `notifications.ts` - Browser notification system
- [ ] Map components (MapView, MapMarker)

**Priority: Medium**
- [ ] `useStats` - Statistics calculations hook
- [ ] Chart components (BatteryChart, SignalChart, etc.)
- [ ] Node list components
- [ ] Message components

**Priority: Low**
- [ ] UI components (Button, Card, etc.)
- [ ] Layout components
- [ ] Page components

## Test Examples

### Testing a Hook

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useSettings } from '../useSettings'

describe('useSettings', () => {
  it('should return current settings on mount', () => {
    const { result } = renderHook(() => useSettings())

    expect(result.current).toBeDefined()
    expect(result.current.compactMode).toBe(false)
  })

  it('should update when settings change', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      const event = new CustomEvent('settings-changed', {
        detail: { compactMode: true },
      })
      window.dispatchEvent(event)
    })

    expect(result.current.compactMode).toBe(true)
  })
})
```

### Testing a Utility Function

```typescript
import { describe, it, expect } from 'vitest'
import { getSettings, saveSettings } from '../settings'

describe('settings', () => {
  it('should save and retrieve settings', () => {
    saveSettings({ compactMode: true })
    const settings = getSettings()

    expect(settings.compactMode).toBe(true)
  })
})
```

### Testing with Mocks

```typescript
import { vi } from 'vitest'

// Mock a module
vi.mock('@/lib/api/client', () => ({
  fetchNodes: vi.fn().mockResolvedValue([]),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
global.localStorage = localStorageMock as any
```

## Global Test Setup

The test setup file (`src/test/setup.ts`) configures:

1. **jest-dom matchers** - Extended assertions for DOM testing
2. **Automatic cleanup** - Cleans up after each test
3. **localStorage mock** - Mocked localStorage API
4. **Notification API mock** - Mocked browser notifications
5. **matchMedia mock** - Mocked media query API

## Best Practices

### Do's ✅

- **Test behavior, not implementation** - Focus on what the code does, not how
- **Use descriptive test names** - "should update when settings change"
- **Arrange-Act-Assert pattern** - Set up, perform action, verify result
- **Mock external dependencies** - API calls, localStorage, etc.
- **Clean up after tests** - Use afterEach and cleanup utilities
- **Test edge cases** - Empty arrays, null values, errors

### Don'ts ❌

- **Don't test React internals** - Focus on user-facing behavior
- **Don't over-mock** - Only mock what's necessary
- **Don't test implementation details** - Test public API only
- **Don't make tests dependent** - Each test should be independent
- **Don't ignore warnings** - Fix console warnings and errors

## Common Patterns

### Testing Async Code

```typescript
import { waitFor } from '@testing-library/react'

it('should load data', async () => {
  const { result } = renderHook(() => useNodes())

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false)
  })

  expect(result.current.data).toBeDefined()
})
```

### Testing Event Handlers

```typescript
import { fireEvent, screen } from '@testing-library/react'

it('should call handler on click', () => {
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Click Me</Button>)

  fireEvent.click(screen.getByText('Click Me'))

  expect(handleClick).toHaveBeenCalledTimes(1)
})
```

### Testing Components with Props

```typescript
it('should render with custom props', () => {
  render(<NodeCard node={mockNode} compact={true} />)

  expect(screen.getByText(mockNode.longName)).toBeInTheDocument()
  expect(screen.getByRole('article')).toHaveClass('compact')
})
```

## Coverage Goals

Current coverage: **~15%** (15/100+ files)

Target coverage by priority:
- **Critical paths**: 90%+ (hooks, API client, settings)
- **Core features**: 75%+ (components, utilities)
- **UI components**: 50%+ (presentational components)

## Continuous Integration

Tests run automatically on:
- Pre-commit hook (future)
- Pull requests (future)
- Main branch commits (future)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
