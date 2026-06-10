const GA_MEASUREMENT_ID = (process.env.REACT_APP_GA_MEASUREMENT_ID || "").trim();
const GA_SCRIPT_ID = "ga4-gtag-script";
const GA_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

let initialized = false;

export function isAnalyticsEnabled() {
  return Boolean(GA_MEASUREMENT_ID);
}

export function getAnalyticsMeasurementId() {
  return GA_MEASUREMENT_ID;
}

export function initAnalytics() {
  if (!isAnalyticsEnabled() || typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  if (!document.getElementById(GA_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = GA_SCRIPT_SRC;
    document.head.appendChild(script);
  }

  if (initialized) {
    return;
  }

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
  });
  initialized = true;
}

export function trackPageView(path) {
  if (!isAnalyticsEnabled() || typeof window === "undefined") {
    return;
  }

  initAnalytics();
  const pagePath = path || `${window.location.pathname}${window.location.search}`;
  window.gtag("event", "page_view", {
    page_title: document.title,
    page_path: pagePath,
    page_location: window.location.href,
  });
}

export function trackEvent(eventName, params = {}) {
  if (!isAnalyticsEnabled() || typeof window === "undefined") {
    return;
  }

  initAnalytics();
  window.gtag("event", eventName, params);
}
