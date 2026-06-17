import { TableAggregate } from "@convex-dev/aggregate";
import { Migrations } from "@convex-dev/migrations";
import { formatISO, parseISO } from "date-fns";
import { Effect as E, Option as O, Schema as S, Struct } from "effect";
import type { HttpClientError } from "effect/unstable/http/HttpClientError";
import { episodeFromDoc, hasEpisodesByShow, readEpisodeByApiId, readEpisodesByShow, readPaginatedEpisodes } from "@/functions/episodes";
import { sEpisodeCreate } from "@/schemas/creates";
import { type Episodes, sEpisode } from "@/schemas/episodes";
import { sShow } from "@/schemas/shows";
import { TvMaze } from "@/services/tvmaze";
import { api, components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import { actionHandler, mutationHandler, queryHandler } from "./effex";
import { sId } from "./effex/schemas/genericId";
import { ActionCtx, type ActionCtxDeps } from "./effex/services/ActionCtx";
import { DatabaseWriter } from "./effex/services/DatabaseWriter";
import { MutationCtx, type MutationCtxDeps } from "./effex/services/MutationCtx";
import { sPaginated, sPaginationWith } from "./effex/utils";
import { mutation, triggers } from "./triggers";

// CONSTANTS -------------------------------------------------------------------------------------------------------------------------------
const WATCH_BATCH_SIZE = 100;
const EPISODE_AGGREGATE_NAMESPACES = [
  ["favorite", false],
  ["favorite", true],
  ["ignored", false],
  ["ignored", true],
  ["unset", false],
  ["unset", true],
] as const satisfies readonly AggregateEpisodesParams["Namespace"][];

// AGGREGATES ------------------------------------------------------------------------------------------------------------------------------
export const unwatchedEpisodes = new TableAggregate<AggregateEpisodesParams>(components.unwatchedEpisodes, {
  namespace: ({ isWatched, preference }) => [preference, isWatched],
  sortKey: ({ airstamp, number, season, showId }) => [-parseISO(airstamp).getTime(), `${showId}`, -season, -(number ?? 0)],
});
triggers.register("episodes", unwatchedEpisodes.idempotentTrigger());

export const upcomingEpisodes = new TableAggregate<AggregateEpisodesParams>(components.upcomingEpisodes, {
  namespace: ({ isWatched, preference }) => [preference, isWatched],
  sortKey: ({ airstamp, number, season, showId }) => [parseISO(airstamp).getTime(), `${showId}`, season, number ?? 0],
});
triggers.register("episodes", upcomingEpisodes.idempotentTrigger());

// QUERIES ---------------------------------------------------------------------------------------------------------------------------------
export const hasByShow = query(
  queryHandler({
    args: sEpisode.mapFields(Struct.pick(["showId"])),
    returns: S.Boolean,
    handler: ({ showId }) => hasEpisodesByShow(showId),
  })
);

export const readByShow = query(
  queryHandler({
    args: sEpisode.mapFields(Struct.pick(["showId"])),
    returns: S.Array(sEpisode),
    handler: E.fn(function* ({ showId }) {
      const docs = yield* readEpisodesByShow(showId);
      return yield* E.all(docs.map(episodeFromDoc));
    }),
  })
);

export const readPaginatedUnwatched = query(
  queryHandler({
    args: sPaginationWith({ timestamp: S.Int }),
    returns: sPaginated(sEpisode),
    handler: ({ timestamp, ...pageArgs }) =>
      readPaginatedEpisodes({
        aggregate: unwatchedEpisodes,
        opts: { namespace: ["favorite", false], bounds: { lower: { inclusive: true, key: [-timestamp] } } },
      })(pageArgs),
  })
);

export const readPaginatedUpcoming = query(
  queryHandler({
    args: sPaginationWith({ timestamp: S.Int }),
    returns: sPaginated(sEpisode),
    handler: ({ timestamp, ...pageArgs }) =>
      readPaginatedEpisodes({
        aggregate: upcomingEpisodes,
        opts: { namespace: ["favorite", false], bounds: { lower: { inclusive: false, key: [timestamp] } } },
      })(pageArgs),
  })
);

// MUTATION --------------------------------------------------------------------------------------------------------------------------------
export const createManyMissingForShow = mutation(
  mutationHandler({
    args: S.Struct({ showId: sId("shows"), dtos: S.mutable(S.Array(sEpisodeCreate)) }),
    returns: S.Array(sId("episodes")),
    handler: E.fn(function* ({ dtos, showId }) {
      const { db } = yield* MutationCtx;
      const { preference } = (yield* db.get("shows", showId)).pipe(O.getOrThrow);
      const ids: Id<"episodes">[] = [];
      for (const dto of dtos)
        if ((yield* readEpisodeByApiId(dto.apiId)).pipe(O.isNone)) ids.push(yield* db.insert("episodes", { ...dto, preference, showId }));
      return ids;
    }),
  })
);

export const setWatched = mutation(
  mutationHandler({
    args: sEpisode.mapFields(Struct.pick(["_id", "isWatched"])),
    returns: S.Null,
    handler: E.fn(function* ({ _id, isWatched }) {
      const db = yield* DatabaseWriter;
      yield* db.patch("episodes", _id, { isWatched });
      return null;
    }),
  })
);

export const setSeasonAiredWatched = mutation(
  mutationHandler({
    args: sEpisode.mapFields(Struct.pick(["isWatched", "season", "showId"])),
    returns: S.Null,
    handler: E.fn(function* ({ isWatched, season, showId }): E.fn.Return<null, S.SchemaError, MutationCtxDeps> {
      const { db, scheduler } = yield* MutationCtx;
      const now = formatISO(Date.now());
      const episodes = yield* db
        .query("episodes")
        .withIndex("by_show_and_season", (q) => q.eq("showId", showId).eq("season", season).lt("airstamp", now))
        .filter((q) => q.neq(q.field("isWatched"), isWatched))
        .take(WATCH_BATCH_SIZE);
      for (const episode of episodes) yield* db.patch("episodes", episode._id, { isWatched });
      if (episodes.length === WATCH_BATCH_SIZE)
        yield* scheduler.runAfter(0, api.episodes.setSeasonAiredWatched, { isWatched, season, showId });
      return null;
    }),
  })
);

export const setShowAiredWatched = mutation(
  mutationHandler({
    args: sEpisode.mapFields(Struct.pick(["isWatched", "showId"])),
    returns: S.Null,
    handler: E.fn(function* ({ isWatched, showId }): E.fn.Return<null, S.SchemaError, MutationCtxDeps> {
      const { db, scheduler } = yield* MutationCtx;
      const now = formatISO(Date.now());
      const episodes = yield* db
        .query("episodes")
        .withIndex("by_show", (q) => q.eq("showId", showId).lt("airstamp", now))
        .filter((q) => q.neq(q.field("isWatched"), isWatched))
        .take(WATCH_BATCH_SIZE);
      for (const episode of episodes) yield* db.patch("episodes", episode._id, { isWatched });
      if (episodes.length === WATCH_BATCH_SIZE) yield* scheduler.runAfter(0, api.episodes.setShowAiredWatched, { isWatched, showId });
      return null;
    }),
  })
);

export const clearAggregates = internalMutation({
  handler: async (ctx) => {
    for (const namespace of EPISODE_AGGREGATE_NAMESPACES) {
      await unwatchedEpisodes.clear(ctx, { namespace });
      await upcomingEpisodes.clear(ctx, { namespace });
    }
    return null;
  },
});

// ACTIONS ---------------------------------------------------------------------------------------------------------------------------------
export const fetchForShow = action(
  actionHandler({
    args: sShow.mapFields(Struct.pick(["_id", "apiId"])),
    returns: S.Array(sId("episodes")),
    handler: ({ _id, apiId }): E.Effect<readonly Id<"episodes">[], S.SchemaError | HttpClientError, ActionCtxDeps> =>
      E.gen(function* () {
        const { runMutation } = yield* ActionCtx;
        const { fetchShowEpisodes } = yield* TvMaze;
        yield* runMutation(api.shows.setTrackEpisodes, { _id, trackEpisodes: true });
        const dtos = yield* fetchShowEpisodes(apiId);
        return yield* runMutation(api.episodes.createManyMissingForShow, { dtos, showId: _id });
      }).pipe(E.provide(TvMaze.layer)),
  })
);

// TYPES -----------------------------------------------------------------------------------------------------------------------------------
type AggregateEpisodesParams = {
  DataModel: DataModel;
  Key: (number | string)[];
  Namespace?: [Episodes["Entity"]["preference"], Episodes["Entity"]["isWatched"]];
  TableName: "episodes";
};

// MIGRATIONS ------------------------------------------------------------------------------------------------------------------------------
export const migrations = new Migrations<DataModel>(components.migrations);
export const run = migrations.runner();

export const backfillAggregatesMigration = migrations.define({
  table: "episodes",
  migrateOne: async (ctx, doc) => {
    await unwatchedEpisodes.insertIfDoesNotExist(ctx, doc);
    await upcomingEpisodes.insertIfDoesNotExist(ctx, doc);
  },
});

export const runAggregateBackfill = migrations.runner(internal.episodes.backfillAggregatesMigration);
