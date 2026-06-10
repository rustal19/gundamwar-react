import { useEffect, useState } from "react";

export const COMPACT_LAYOUT_MAX_WIDTH = 1100;

export function getForcedMobileLayout(searchString) {
  const sourceSearch =
    typeof searchString === "string"
      ? searchString
      : typeof window !== "undefined"
        ? window.location.search
        : "";

  const forcedLayout = new URLSearchParams(sourceSearch).get("mobileLayout");

  if (forcedLayout === "ios" || forcedLayout === "android" || forcedLayout === "1") {
    return forcedLayout;
  }

  return "";
}

export function preserveForcedMobileLayoutInParams(params, searchString) {
  if (!(params instanceof URLSearchParams)) {
    return params;
  }

  const forcedLayout = getForcedMobileLayout(searchString);

  if (forcedLayout && !params.has("mobileLayout")) {
    params.set("mobileLayout", forcedLayout);
  }

  return params;
}

export function buildPathWithForcedMobileLayout(path, searchString) {
  const forcedLayout = getForcedMobileLayout(searchString);

  if (!forcedLayout) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}mobileLayout=${encodeURIComponent(forcedLayout)}`;
}

function getViewportWidth() {
  if (typeof window === "undefined") {
    return 0;
  }

  return Math.max(
    Number(window.innerWidth || 0),
    Number(document.documentElement?.clientWidth || 0)
  );
}

function areLayoutStatesEqual(left, right) {
  return (
    left.layoutTier === right.layoutTier &&
    left.viewportWidth === right.viewportWidth &&
    left.isCompactLayout === right.isCompactLayout &&
    left.isCompactDesktop === right.isCompactDesktop &&
    left.isMobileOs === right.isMobileOs &&
    left.isIos === right.isIos &&
    left.isAndroid === right.isAndroid
  );
}

export function detectMobileOsLayout(searchString) {
  if (typeof navigator === "undefined" && typeof window === "undefined") {
    return {
      isMobileOs: false,
      isIos: false,
      isAndroid: false,
    };
  }

  if (typeof window !== "undefined") {
    const forcedLayout = getForcedMobileLayout(
      typeof searchString === "string" ? searchString : window.location.search
    );

    if (forcedLayout === "ios" || forcedLayout === "android" || forcedLayout === "1") {
      const isIos = forcedLayout === "ios" || forcedLayout === "1";
      const isAndroid = forcedLayout === "android";

      return {
        isMobileOs: true,
        isIos,
        isAndroid,
      };
    }
  }

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0);

  const isIos =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);

  return {
    isMobileOs: isIos || isAndroid,
    isIos,
    isAndroid,
  };
}

export function getLayoutTier(searchString) {
  const mobileState = detectMobileOsLayout(searchString);
  const viewportWidth = getViewportWidth();
  const isCompactDesktop =
    !mobileState.isMobileOs &&
    viewportWidth > 0 &&
    viewportWidth <= COMPACT_LAYOUT_MAX_WIDTH;
  const isCompactLayout = mobileState.isMobileOs || isCompactDesktop;

  return {
    ...mobileState,
    viewportWidth,
    isCompactDesktop,
    isCompactLayout,
    layoutTier: mobileState.isMobileOs
      ? "mobile"
      : isCompactDesktop
        ? "compact-desktop"
        : "desktop",
  };
}

export function useLayoutTier(searchString) {
  const [layoutTier, setLayoutTier] = useState(() => getLayoutTier(searchString));

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateLayoutTier = () => {
      setLayoutTier((current) => {
        const next = getLayoutTier(searchString);
        return areLayoutStatesEqual(current, next) ? current : next;
      });
    };

    updateLayoutTier();
    window.addEventListener("resize", updateLayoutTier);
    window.addEventListener("orientationchange", updateLayoutTier);

    return () => {
      window.removeEventListener("resize", updateLayoutTier);
      window.removeEventListener("orientationchange", updateLayoutTier);
    };
  }, [searchString]);

  return layoutTier;
}
