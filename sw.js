const CACHE_NAME = "pixel-plan-v9";
const STATIC_CACHE_NAME = "pixel-plan-static-v9";
const RUNTIME_CACHE_NAME = "pixel-plan-runtime-v9";

// Core app resources that must be cached
const CORE_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192x192.png",
  "./icon-512x512.png",
];

// External resources to cache with network-first strategy
const EXTERNAL_RESOURCES = [
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/react@18/umd/react.development.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.development.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Pangolin&display=swap",
];

// --- Helper Functions for Notifications ---
const formatDate = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const options = { weekday: 'short', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
};

const convertTimeToISO = (timeString) => {
    if (!timeString || typeof timeString !== 'string') return '12:00';
    try {
        const trimmed = timeString.trim();
        if (!trimmed) return '12:00';
        // Handle 24-hour format (e.g., "14:30")
        if (!trimmed.includes(' ')) {
            const [hours, minutes] = trimmed.split(':');
            const h = parseInt(hours) || 0;
            const m = parseInt(minutes) || 0;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }
        // Handle 12-hour format (e.g., "2:30 PM")
        const [time, period] = trimmed.split(' ');
        let [hours, minutes] = time.split(':');
        hours = parseInt(hours) || 0;
        minutes = parseInt(minutes) || 0;
        if (period && period.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
        }
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } catch (error) {
        console.error('convertTimeToISO: Error converting time string:', timeString, error);
        return '12:00';
    }
};


// Install event - cache core files
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...");
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Caching core app files");
        return cache.addAll(CORE_FILES);
      })
      .then(() => {
        console.log("Service Worker: Skip waiting");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("Service Worker: Failed to cache core files:", error);
      }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== STATIC_CACHE_NAME &&
              cacheName !== RUNTIME_CACHE_NAME
            ) {
              console.log("Service Worker: Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log("Service Worker: Claiming clients");
        return self.clients.claim();
      }),
  );
});

// Fetch event - implement cache strategies
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Handle core app files with cache-first strategy
  if (CORE_FILES.some((file) => request.url.includes(file.replace("./", "")))) {
    event.respondWith(
      caches
        .match(request)
        .then((response) => {
          return (
            response ||
            fetch(request).then((fetchResponse) => {
              const responseClone = fetchResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
              return fetchResponse;
            })
          );
        })
        .catch(() => {
          // Fallback for core files
          if (request.url.includes("index.html") || request.url.endsWith("/")) {
            return caches.match("./index.html");
          }
        }),
    );
    return;
  }

  // Handle external resources with network-first strategy
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for external resources
          return caches.match(request);
        }),
    );
    return;
  }

  // Default strategy for other requests
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    }),
  );
});

// Handle background sync for offline functionality
self.addEventListener("sync", (event) => {
  console.log("Service Worker: Background sync triggered");
  if (event.tag === "background-sync") {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Placeholder for background sync logic
  return Promise.resolve();
}

// Handle push notifications from a server (if you implement them later)
self.addEventListener("push", (event) => {
  console.log("Service Worker: Push message received");

  const options = {
    body: event.data ? event.data.text() : "New notification from Pixel Plan",
    icon: "./icon-192x192.png",
    badge: "./icon-192x192.png",
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "Open App",
        icon: "./icon-192x192.png",
      },
      {
        action: "close",
        title: "Close",
        icon: "./icon-192x192.png",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification("Pixel Plan", options));
});


// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("Service Worker: Notification click received", event.action);

  event.notification.close();

  if (event.action === "explore") {
    event.waitUntil(clients.openWindow("./"));
  } else if (event.action === "complete") {
    // Handle task completion by sending a message back to the app
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].postMessage({
            type: 'COMPLETE_TASK',
            taskId: event.notification.data.taskId
          });
          return clientList[0].focus();
        } else {
          return clients.openWindow("./");
        }
      })
    );
  } else if (event.action === "postpone") {
    // Handle task postponement by sending a message back to the app
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].postMessage({
            type: 'POSTPONE_TASK',
            taskId: event.notification.data.taskId
          });
          return clientList[0].focus();
        } else {
          return clients.openWindow("./");
        }
      })
    );
  } else {
    // Default action - open app
    event.waitUntil(clients.openWindow("./"));
  }
});
