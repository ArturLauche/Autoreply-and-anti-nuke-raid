/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as antinuke from "../antinuke.js";
import type * as auth from "../auth.js";
import type * as autoreplies from "../autoreplies.js";
import type * as backup from "../backup.js";
import type * as backup_github from "../backup_github.js";
import type * as bot_writes from "../bot_writes.js";
import type * as guilds from "../guilds.js";
import type * as haimiya from "../haimiya.js";
import type * as hidden from "../hidden.js";
import type * as modules from "../modules.js";
import type * as public_ from "../public.js";
import type * as reports from "../reports.js";
import type * as sessions from "../sessions.js";
import type * as sha256 from "../sha256.js";
import type * as status from "../status.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  antinuke: typeof antinuke;
  auth: typeof auth;
  autoreplies: typeof autoreplies;
  backup: typeof backup;
  backup_github: typeof backup_github;
  bot_writes: typeof bot_writes;
  guilds: typeof guilds;
  haimiya: typeof haimiya;
  hidden: typeof hidden;
  modules: typeof modules;
  public: typeof public_;
  reports: typeof reports;
  sessions: typeof sessions;
  sha256: typeof sha256;
  status: typeof status;
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
