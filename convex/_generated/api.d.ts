/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as dashboard from "../dashboard.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as integration from "../integration.js";
import type * as lib_accounting from "../lib/accounting.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_breakdown from "../lib/breakdown.js";
import type * as master from "../master.js";
import type * as me from "../me.js";
import type * as periods from "../periods.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as supporting from "../supporting.js";
import type * as transactions from "../transactions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  auth: typeof auth;
  dashboard: typeof dashboard;
  files: typeof files;
  http: typeof http;
  imports: typeof imports;
  integration: typeof integration;
  "lib/accounting": typeof lib_accounting;
  "lib/authz": typeof lib_authz;
  "lib/breakdown": typeof lib_breakdown;
  master: typeof master;
  me: typeof me;
  periods: typeof periods;
  reports: typeof reports;
  seed: typeof seed;
  supporting: typeof supporting;
  transactions: typeof transactions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
