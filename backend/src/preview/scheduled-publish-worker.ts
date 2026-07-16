import type { PreviewService } from "./preview-service.js";

export type ScheduledPublishWorkerResult = Readonly<{
  processed: number;
  published: number;
  failed: number;
}>;

/** Drain due immutable snapshots. Claiming is atomic in SQLite, so multiple workers can poll safely. */
export async function processDueScheduledSnapshots(
  previewService: Pick<PreviewService, "claimDue" | "releaseClaim" | "cancelSchedule" | "publishSnapshot">,
  workerId: string,
  now = new Date(),
): Promise<ScheduledPublishWorkerResult> {
  let processed = 0;
  let published = 0;
  let failed = 0;
  while (true) {
    const snapshot = previewService.claimDue(workerId, now);
    if (!snapshot) break;
    processed += 1;
    try {
      previewService.publishSnapshot({
        snapshotId: snapshot.id,
        expectedHash: snapshot.contentHash,
        actorId: workerId,
      });
      published += 1;
    } catch (error) {
      failed += 1;
      previewService.releaseClaim(snapshot.id, workerId);
      // A stale or expired snapshot cannot become valid later. Remove its schedule
      // so the worker does not retry it forever; the audit trail keeps the failure.
      if (error instanceof Error && [
        "SNAPSHOT_EXPIRED",
        "SNAPSHOT_SOURCE_SET_CHANGED",
        "SNAPSHOT_SOURCE_NOT_FOUND",
        "SNAPSHOT_SOURCE_NOT_APPROVED",
        "SNAPSHOT_SOURCE_INCOMPLETE",
        "SNAPSHOT_SOURCE_UNVERIFIED",
        "CONTENT_VERSION_CONFLICT",
      ].includes((error as Error & { code?: string }).code ?? "")) {
        try {
          previewService.cancelSchedule({ snapshotId: snapshot.id, actorId: workerId });
        } catch {
          // Keep the original publication error as the useful diagnostic.
        }
      } else {
        // Leave transient failures claimed only for this attempt and retry on the
        // next poll; do not spin on the same row within this drain cycle.
        break;
      }
    }
  }
  return { processed, published, failed };
}
