# Session Storage Management Guide

This guide explains how to properly manage sessionStorage in the frontend to keep data synchronized with the backend database.

## Table of Contents
- [Reading from Session Storage](#reading-from-session-storage)
- [Writing to Session Storage](#writing-to-session-storage)
- [Updating Session Storage After Database Writes](#updating-session-storage-after-database-writes)
- [Best Practices](#best-practices)

---

## Reading from Session Storage

### Basic Read Operation

```javascript
const getCompanyFromSession = (companyId) => {
  const cacheKey = `company_${companyId}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (!cached) {
    return null;
  }

  try {
    const cachedData = JSON.parse(cached);

    // Check if cache is still valid (5 minutes)
    const cacheAge = Date.now() - (cachedData.timestamp || 0);
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    if (cacheAge < CACHE_DURATION) {
      return cachedData;
    } else {
      // Cache expired, remove it
      sessionStorage.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    // Invalid JSON, remove corrupted cache
    sessionStorage.removeItem(cacheKey);
    return null;
  }
};

// Usage
const companyData = getCompanyFromSession(companyId);
if (companyData) {
  console.log("Using cached data:", companyData);
} else {
  console.log("Cache miss, fetch from API");
}
```

### Read with Fallback to API

```javascript
const fetchCompanyWithCache = async (companyId, getToken) => {
  // Try to read from cache first
  const cached = getCompanyFromSession(companyId);
  if (cached) {
    return cached;
  }

  // Cache miss, fetch from API
  const token = await getToken({ template: "default" });
  const response = await fetch(`${VITE_API_URL}/api/company/${companyId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.ok) {
    const data = await response.json();

    // Store in cache with timestamp
    const cacheData = {
      ...data,
      timestamp: Date.now()
    };

    sessionStorage.setItem(`company_${companyId}`, JSON.stringify(cacheData));
    return cacheData;
  }

  throw new Error("Failed to fetch company");
};
```

---

## Writing to Session Storage

### Basic Write Operation

```javascript
const saveToSession = (key, data) => {
  const cacheData = {
    ...data,
    timestamp: Date.now()
  };

  sessionStorage.setItem(key, JSON.stringify(cacheData));
};

// Usage
saveToSession(`company_${companyId}`, companyData);
```

### Write with Expiration Time

```javascript
const saveToSessionWithExpiry = (key, data, expiryMinutes = 5) => {
  const cacheData = {
    ...data,
    timestamp: Date.now(),
    expiryMinutes
  };

  sessionStorage.setItem(key, JSON.stringify(cacheData));
};

// Usage
saveToSessionWithExpiry(`driver_${driverId}`, driverData, 10); // 10-minute cache
```

---

## Updating Session Storage After Database Writes

### Important: Prevent Stale Data

When you perform any CREATE, UPDATE, or DELETE operation on the backend, you MUST update or invalidate the sessionStorage to prevent serving stale data.

### Strategy 1: Invalidate (Remove) Cache

**Best for:** Complex data structures, when you're unsure what changed

```javascript
const updateCompany = async (companyId, updates, getToken) => {
  const token = await getToken({ template: "default" });

  // Update in database
  const response = await fetch(`${VITE_API_URL}/api/company/${companyId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates)
  });

  if (response.ok) {
    // IMPORTANT: Invalidate cache immediately after write
    sessionStorage.removeItem(`company_${companyId}`);

    // Next read will fetch fresh data from API
    return await response.json();
  }

  throw new Error("Failed to update company");
};
```

### Strategy 2: Optimistic Update (Update Cache Immediately)

**Best for:** Simple updates where you know the exact changes

```javascript
const updateCompanyOptimistic = async (companyId, updates, getToken) => {
  const token = await getToken({ template: "default" });

  // Get current cache
  const cached = getCompanyFromSession(companyId);

  // Optimistically update cache before API call
  const optimisticData = {
    ...cached,
    ...updates,
    timestamp: Date.now()
  };
  sessionStorage.setItem(`company_${companyId}`, JSON.stringify(optimisticData));

  try {
    // Update in database
    const response = await fetch(`${VITE_API_URL}/api/company/${companyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates)
    });

    if (response.ok) {
      const actualData = await response.json();

      // Update cache with actual response from server
      const finalData = {
        ...actualData,
        timestamp: Date.now()
      };
      sessionStorage.setItem(`company_${companyId}`, JSON.stringify(finalData));

      return actualData;
    } else {
      // Revert optimistic update on failure
      if (cached) {
        sessionStorage.setItem(`company_${companyId}`, JSON.stringify(cached));
      } else {
        sessionStorage.removeItem(`company_${companyId}`);
      }
      throw new Error("Failed to update company");
    }
  } catch (error) {
    // Revert on error
    if (cached) {
      sessionStorage.setItem(`company_${companyId}`, JSON.stringify(cached));
    } else {
      sessionStorage.removeItem(`company_${companyId}`);
    }
    throw error;
  }
};
```

### Strategy 3: Invalidate Related Caches

**Best for:** When one update affects multiple cached items

```javascript
const deleteDriver = async (driverId, companyId, getToken) => {
  const token = await getToken({ template: "default" });

  const response = await fetch(`${VITE_API_URL}/api/drivers/${driverId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });

  if (response.ok) {
    // IMPORTANT: Invalidate all related caches
    sessionStorage.removeItem(`driver_${driverId}`);
    sessionStorage.removeItem(`drivers_list_${companyId}`); // List cache
    sessionStorage.removeItem(`company_stats_${companyId}`); // Stats cache

    return true;
  }

  throw new Error("Failed to delete driver");
};
```

---

## Best Practices

### 1. Always Use Consistent Cache Keys

```javascript
// Good: Consistent naming convention
const CACHE_KEYS = {
  company: (id) => `company_${id}`,
  driver: (id) => `driver_${id}`,
  driversList: (companyId) => `drivers_list_${companyId}`,
  documentTypes: (companyId) => `document_types_${companyId}`,
};

// Usage
sessionStorage.setItem(CACHE_KEYS.company(companyId), data);
```

### 2. Create Utility Functions

```javascript
// utils/sessionCache.js
export const sessionCache = {
  get: (key, maxAgeMinutes = 5) => {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    try {
      const data = JSON.parse(cached);
      const age = Date.now() - (data.timestamp || 0);
      const maxAge = maxAgeMinutes * 60 * 1000;

      if (age < maxAge) {
        return data;
      } else {
        sessionStorage.removeItem(key);
        return null;
      }
    } catch {
      sessionStorage.removeItem(key);
      return null;
    }
  },

  set: (key, data) => {
    const cacheData = { ...data, timestamp: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(cacheData));
  },

  remove: (key) => {
    sessionStorage.removeItem(key);
  },

  invalidatePattern: (pattern) => {
    // Remove all keys matching pattern
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes(pattern)) {
        sessionStorage.removeItem(key);
      }
    });
  },

  clear: () => {
    sessionStorage.clear();
  }
};
```

### 3. Invalidate on Mutations

```javascript
// Example: After any company update
const handleCompanyUpdate = async (companyId, updates) => {
  await updateCompanyAPI(companyId, updates);

  // Invalidate cache
  sessionCache.remove(CACHE_KEYS.company(companyId));

  // Trigger re-fetch or state update
  const freshData = await fetchCompany(companyId);
  setCompanyDetails(freshData);
};
```

### 4. Handle Race Conditions

```javascript
let fetchPromise = null;

const fetchCompanyWithDedup = async (companyId) => {
  // Check cache first
  const cached = sessionCache.get(CACHE_KEYS.company(companyId));
  if (cached) return cached;

  // If already fetching, return existing promise
  if (fetchPromise) return fetchPromise;

  // Create new fetch promise
  fetchPromise = fetch(`${VITE_API_URL}/api/company/${companyId}`)
    .then(res => res.json())
    .then(data => {
      sessionCache.set(CACHE_KEYS.company(companyId), data);
      fetchPromise = null;
      return data;
    })
    .catch(err => {
      fetchPromise = null;
      throw err;
    });

  return fetchPromise;
};
```

### 5. Clear Cache on Logout

```javascript
// In your logout handler
const handleLogout = () => {
  // Clear all session storage
  sessionStorage.clear();

  // Perform logout
  clerk.signOut();
};
```

---

## Common Patterns

### Pattern 1: Component-Level Caching

```javascript
const CompanyProfile = () => {
  const { user, getToken } = useAuth();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    const loadCompany = async () => {
      const companyId = user?.publicMetadata?.companyId;
      if (!companyId) return;

      // Try cache first
      const cached = sessionCache.get(CACHE_KEYS.company(companyId));
      if (cached) {
        setCompany(cached);
        return;
      }

      // Fetch from API
      const data = await fetchCompany(companyId, getToken);
      sessionCache.set(CACHE_KEYS.company(companyId), data);
      setCompany(data);
    };

    loadCompany();
  }, [user, getToken]);

  const handleUpdate = async (updates) => {
    const companyId = user.publicMetadata.companyId;

    // Update backend
    await updateCompanyAPI(companyId, updates);

    // Invalidate cache
    sessionCache.remove(CACHE_KEYS.company(companyId));

    // Refetch and update state
    const fresh = await fetchCompany(companyId, getToken);
    sessionCache.set(CACHE_KEYS.company(companyId), fresh);
    setCompany(fresh);
  };

  return <div>{/* UI */}</div>;
};
```

### Pattern 2: Global State with Cache Sync

```javascript
// In a context or state management solution
const CompanyContext = createContext();

export const CompanyProvider = ({ children }) => {
  const { user, getToken } = useAuth();
  const [company, setCompany] = useState(null);

  const fetchCompany = async () => {
    const companyId = user?.publicMetadata?.companyId;
    const cached = sessionCache.get(CACHE_KEYS.company(companyId));

    if (cached) {
      setCompany(cached);
      return cached;
    }

    const data = await fetchCompanyAPI(companyId, getToken);
    sessionCache.set(CACHE_KEYS.company(companyId), data);
    setCompany(data);
    return data;
  };

  const updateCompany = async (updates) => {
    const companyId = user.publicMetadata.companyId;
    const updated = await updateCompanyAPI(companyId, updates);

    // Update both cache and state
    sessionCache.set(CACHE_KEYS.company(companyId), updated);
    setCompany(updated);

    return updated;
  };

  return (
    <CompanyContext.Provider value={{ company, fetchCompany, updateCompany }}>
      {children}
    </CompanyContext.Provider>
  );
};
```

---

## Summary Checklist

When working with sessionStorage and database operations:

- ✅ Always check cache before API calls
- ✅ Store timestamp with cached data
- ✅ Set appropriate expiry times (5-10 minutes recommended)
- ✅ **INVALIDATE cache after ANY database write (CREATE/UPDATE/DELETE)**
- ✅ Use consistent cache key naming
- ✅ Handle JSON parse errors gracefully
- ✅ Clear cache on user logout
- ✅ Consider optimistic updates for better UX
- ✅ Invalidate related caches when data relationships change
- ✅ Use utility functions to avoid code duplication

---

## Additional Resources

- [MDN sessionStorage Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
- [React Cache Patterns](https://react.dev/learn/you-might-not-need-an-effect#caching-expensive-calculations)
