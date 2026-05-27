/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as effex_errors from "../effex/errors.js";
import type * as effex_fields from "../effex/fields.js";
import type * as effex_index from "../effex/index.js";
import type * as effex_schemas_errors from "../effex/schemas/errors.js";
import type * as effex_schemas_genericId from "../effex/schemas/genericId.js";
import type * as effex_schemas_index from "../effex/schemas/index.js";
import type * as effex_services_ActionCtx from "../effex/services/ActionCtx.js";
import type * as effex_services_Auth from "../effex/services/Auth.js";
import type * as effex_services_DatabaseReader from "../effex/services/DatabaseReader.js";
import type * as effex_services_DatabaseWriter from "../effex/services/DatabaseWriter.js";
import type * as effex_services_Helpers from "../effex/services/Helpers.js";
import type * as effex_services_MutationCtx from "../effex/services/MutationCtx.js";
import type * as effex_services_OrderedQuery from "../effex/services/OrderedQuery.js";
import type * as effex_services_Query from "../effex/services/Query.js";
import type * as effex_services_QueryCtx from "../effex/services/QueryCtx.js";
import type * as effex_services_QueryInitializer from "../effex/services/QueryInitializer.js";
import type * as effex_services_Scheduler from "../effex/services/Scheduler.js";
import type * as effex_services_StorageActionWriter from "../effex/services/StorageActionWriter.js";
import type * as effex_services_StorageReader from "../effex/services/StorageReader.js";
import type * as effex_services_StorageWriter from "../effex/services/StorageWriter.js";
import type * as effex_utils from "../effex/utils.js";
import type * as episodes from "../episodes.js";
import type * as fetcher from "../fetcher.js";
import type * as shows from "../shows.js";
import type * as triggers from "../triggers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "effex/errors": typeof effex_errors;
  "effex/fields": typeof effex_fields;
  "effex/index": typeof effex_index;
  "effex/schemas/errors": typeof effex_schemas_errors;
  "effex/schemas/genericId": typeof effex_schemas_genericId;
  "effex/schemas/index": typeof effex_schemas_index;
  "effex/services/ActionCtx": typeof effex_services_ActionCtx;
  "effex/services/Auth": typeof effex_services_Auth;
  "effex/services/DatabaseReader": typeof effex_services_DatabaseReader;
  "effex/services/DatabaseWriter": typeof effex_services_DatabaseWriter;
  "effex/services/Helpers": typeof effex_services_Helpers;
  "effex/services/MutationCtx": typeof effex_services_MutationCtx;
  "effex/services/OrderedQuery": typeof effex_services_OrderedQuery;
  "effex/services/Query": typeof effex_services_Query;
  "effex/services/QueryCtx": typeof effex_services_QueryCtx;
  "effex/services/QueryInitializer": typeof effex_services_QueryInitializer;
  "effex/services/Scheduler": typeof effex_services_Scheduler;
  "effex/services/StorageActionWriter": typeof effex_services_StorageActionWriter;
  "effex/services/StorageReader": typeof effex_services_StorageReader;
  "effex/services/StorageWriter": typeof effex_services_StorageWriter;
  "effex/utils": typeof effex_utils;
  episodes: typeof episodes;
  fetcher: typeof fetcher;
  shows: typeof shows;
  triggers: typeof triggers;
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

export declare const components: {
  favoriteShows: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"favoriteShows">;
  topRatedShows: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"topRatedShows">;
  topRatedShowsByYear: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"topRatedShowsByYear">;
  topRatedShowsByPreference: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"topRatedShowsByPreference">;
  topRatedShowsByPreferenceAndYear: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"topRatedShowsByPreferenceAndYear">;
  trendingShows: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"trendingShows">;
  trendingShowsByYear: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"trendingShowsByYear">;
  trendingShowsByPreference: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"trendingShowsByPreference">;
  trendingShowsByPreferenceAndYear: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"trendingShowsByPreferenceAndYear">;
  unwatchedEpisodes: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"unwatchedEpisodes">;
  upcomingEpisodes: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"upcomingEpisodes">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
