import { TableAggregate } from "@convex-dev/aggregate";
import { parseISO } from "date-fns";
import type { Episodes } from "@/schemas/episodes";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

type AggregateEpisodesParams = {
  DataModel: DataModel;
  Key: (number | string)[];
  Namespace?: [Episodes["Entity"]["preference"], Episodes["Entity"]["isWatched"]];
  TableName: "episodes";
};

export const unwatchedEpisodes = new TableAggregate<AggregateEpisodesParams>(components.unwatchedEpisodes, {
  namespace: ({ isWatched, preference }) => [preference, isWatched],
  sortKey: ({ airstamp, number, season, showId }) => [-parseISO(airstamp).getTime(), `${showId}`, -season, -(number ?? 0)],
});

export const upcomingEpisodes = new TableAggregate<AggregateEpisodesParams>(components.upcomingEpisodes, {
  namespace: ({ isWatched, preference }) => [preference, isWatched],
  sortKey: ({ airstamp, number, season, showId }) => [parseISO(airstamp).getTime(), `${showId}`, season, number ?? 0],
});
