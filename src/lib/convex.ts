import { ConvexReactClient } from "convex/react";

const configuredUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
// Public deployment endpoint fallback prevents a blank app if the hosting
// provider delays injecting VITE_CONVEX_URL during a rebuild or injects a
// protected value instead of the public URL.
const productionUrl = "https://gregarious-snail-795.convex.cloud";
const isConvexUrl = (value: string | undefined): value is string =>
  typeof value === "string" && /^https?:\/\/[a-z0-9.-]+\.convex\.cloud(?:\/|$)/i.test(value);
const url = isConvexUrl(configuredUrl) ? configuredUrl : productionUrl;

export const backendWarning = /^https?:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(url);

export const convex = new ConvexReactClient(url);
