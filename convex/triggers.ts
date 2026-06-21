import { customCtx, customMutation } from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation as rawInternalMutation, mutation as rawMutation } from "./_generated/server";
import { unwatchedEpisodes, upcomingEpisodes } from "./aggregates/episodes";
import {
  favoriteShows,
  topRatedShows,
  topRatedShowsByPreference,
  topRatedShowsByPreferenceAndYear,
  topRatedShowsByYear,
  trendingShows,
  trendingShowsByPreference,
  trendingShowsByPreferenceAndYear,
  trendingShowsByYear,
} from "./aggregates/shows";

export const triggers = new Triggers<DataModel>();

triggers.register("episodes", unwatchedEpisodes.idempotentTrigger());
triggers.register("episodes", upcomingEpisodes.idempotentTrigger());

triggers.register("shows", favoriteShows.idempotentTrigger());
triggers.register("shows", topRatedShows.idempotentTrigger());
triggers.register("shows", topRatedShowsByYear.idempotentTrigger());
triggers.register("shows", topRatedShowsByPreference.idempotentTrigger());
triggers.register("shows", topRatedShowsByPreferenceAndYear.idempotentTrigger());
triggers.register("shows", trendingShows.idempotentTrigger());
triggers.register("shows", trendingShowsByYear.idempotentTrigger());
triggers.register("shows", trendingShowsByPreference.idempotentTrigger());
triggers.register("shows", trendingShowsByPreferenceAndYear.idempotentTrigger());

const triggerContext = customCtx(triggers.wrapDB);

export const mutation = customMutation(rawMutation, triggerContext);
export const internalMutation = customMutation(rawInternalMutation, triggerContext);
