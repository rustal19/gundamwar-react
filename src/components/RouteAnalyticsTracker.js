import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initAnalytics, isAnalyticsEnabled, trackPageView } from "../utils/analytics";

export default function RouteAnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (!isAnalyticsEnabled()) {
      return;
    }

    initAnalytics();
  }, []);

  useEffect(() => {
    if (!isAnalyticsEnabled()) {
      return;
    }

    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}
