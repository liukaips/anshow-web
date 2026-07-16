import { eq, and, lte, asc, type SQL } from "drizzle-orm";
import type { AppDatabase } from "../db/client.js";
import { inquiries, inquiryHistory, inquiryNotes, notificationDeliveries } from "../db/schema/inquiries.js";
import { assertInquiryTransition, type InquiryStatus } from "./state-machine.js";
import type { ValidInquiry } from "./schema.js";

export type NewInquiryInput = Omit<ValidInquiry,"website"|"startedAt"> & { sourceUrl:string; referrer?:string|null; utmSource?:string|null; utmMedium?:string|null; utmCampaign?:string|null };
export function createInquiryRepository(db: AppDatabase) {
  return {
    createWithNotification(input: NewInquiryInput) {
      const now = Date.now();
      return db.transaction((tx) => {
        const id = crypto.randomUUID();
        const row = tx.insert(inquiries).values({id,name:input.name,company:input.company,email:input.email,phone:input.phone,transportNeed:input.transportNeed,message:input.message,locale:input.locale,sourceUrl:input.sourceUrl,referrer:input.referrer??null,utmSource:input.utmSource??null,utmMedium:input.utmMedium??null,utmCampaign:input.utmCampaign??null,privacyVersion:input.privacyVersion,consentedAt:now,status:"new",createdAt:now}).returning().get();
        tx.insert(notificationDeliveries).values({id:crypto.randomUUID(),inquiryId:id,status:"pending",attempts:0,nextAttemptAt:now,idempotencyKey:`inquiry:${id}:sales`}).run();
        tx.insert(inquiryHistory).values({id:crypto.randomUUID(),inquiryId:id,toStatus:"new",createdAt:now}).run();
        return row;
      });
    },
    list(filters: {status?: InquiryStatus; assigneeId?: string; limit?: number; offset?: number} = {}) {
      const conditions = [filters.status ? eq(inquiries.status,filters.status) : undefined, filters.assigneeId ? eq(inquiries.assigneeId,filters.assigneeId) : undefined].filter((condition): condition is SQL => condition !== undefined);
      const query = db.select().from(inquiries).orderBy(asc(inquiries.createdAt)).limit(filters.limit??50).offset(filters.offset??0);
      return conditions.length ? query.where(and(...conditions)).all() : query.all();
    },
    get(id:string) { return db.select().from(inquiries).where(eq(inquiries.id,id)).get() ?? null; },
    updateStatus(id:string, status:InquiryStatus, actorId:string) { return db.transaction(tx=>{ const current=tx.select().from(inquiries).where(eq(inquiries.id,id)).get(); if(!current) throw new Error("INQUIRY_NOT_FOUND"); assertInquiryTransition(current.status as InquiryStatus, status); tx.update(inquiries).set({status}).where(eq(inquiries.id,id)).run(); tx.insert(inquiryHistory).values({id:crypto.randomUUID(),inquiryId:id,actorId,assigneeId:current.assigneeId,fromStatus:current.status,toStatus:status,createdAt:Date.now()}).run(); return {...current,status}; }); },
    assign(id:string, assigneeId:string|null, actorId:string) { return db.transaction(tx=>{ const current=tx.select().from(inquiries).where(eq(inquiries.id,id)).get(); if(!current) throw new Error("INQUIRY_NOT_FOUND"); tx.update(inquiries).set({assigneeId}).where(eq(inquiries.id,id)).run(); tx.insert(inquiryHistory).values({id:crypto.randomUUID(),inquiryId:id,actorId,assigneeId,fromStatus:current.status,toStatus:current.status,createdAt:Date.now()}).run(); return {...current,assigneeId}; }); },
    addNote(inquiryId:string, authorId:string, body:string) { return db.insert(inquiryNotes).values({id:crypto.randomUUID(),inquiryId,authorId,body,createdAt:Date.now()}).returning().get(); },
    history(inquiryId:string) { return db.select().from(inquiryHistory).where(eq(inquiryHistory.inquiryId,inquiryId)).all(); },
    claimDue(workerId:string, now=Date.now()) { return db.transaction(tx=>{ const job=tx.select().from(notificationDeliveries).where(and(eq(notificationDeliveries.status,"pending"),lte(notificationDeliveries.nextAttemptAt,now))).limit(1).get(); if(!job)return null; tx.update(notificationDeliveries).set({status:"processing",workerId,claimedAt:now,attempts:job.attempts+1}).where(eq(notificationDeliveries.id,job.id)).run(); return {...job,attempts:job.attempts+1}; }); },
    markSent(id:string) { db.update(notificationDeliveries).set({status:"sent",sentAt:Date.now()}).where(eq(notificationDeliveries.id,id)).run(); },
    markFailed(id:string,error:string, maxAttempts=5) { const job=db.select().from(notificationDeliveries).where(eq(notificationDeliveries.id,id)).get(); if(!job)return; const terminal=job.attempts>=maxAttempts; db.update(notificationDeliveries).set({status:terminal?"failed":"pending",lastError:error.slice(0,500),nextAttemptAt:Date.now()+Math.min(3600000,2**job.attempts*1000)}).where(eq(notificationDeliveries.id,id)).run(); },
  };
}
