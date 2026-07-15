export const processStageIds = ["route", "pickup", "customs", "transit", "delivery"] as const;

export type ProcessStageId = (typeof processStageIds)[number];

export type ProcessStage = {
  id: ProcessStageId;
  title: string;
  phases: readonly [string, string, string];
};

