export interface OutboxRepository {
  claimDue(workerId:string): { id:string; inquiryId:string; attempts:number } | null;
  markSent(id:string): void;
  markFailed(id:string,error:string,maxAttempts?:number): void;
}
export type DeliveryJob = {
  id: string;
  inquiryId: string;
  attempts: number;
  idempotencyKey: string;
  to?: string;
};
export interface NotificationTransport { send(input:{inquiryId:string}): Promise<void>; }
const retryMinutes = [1, 5, 15, 60, 360] as const;
export function nextRetryAt(base: Date, attempt: number): Date {
  const minutes = retryMinutes[Math.min(Math.max(attempt, 1) - 1, retryMinutes.length - 1)];
  return new Date(base.getTime() + minutes * 60_000);
}
export async function processOne(repo:OutboxRepository, transport:NotificationTransport, workerId:string) {
  const job=repo.claimDue(workerId); if(!job) return {processed:false as const};
  try { await transport.send({inquiryId:job.inquiryId}); repo.markSent(job.id); return {processed:true as const,status:"sent" as const}; }
  catch(error) { const message=error instanceof Error?error.message:String(error); repo.markFailed(job.id,message); return {processed:true as const,status:"retry" as const}; }
}
