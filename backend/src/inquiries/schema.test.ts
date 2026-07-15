import { expect,it } from "vitest"; import { enquirySchema } from "./schema.js";
it("requires email or phone",()=>expect(enquirySchema.safeParse({name:"Elena",company:"Volga",email:"",phone:"",transportNeed:"Rail",message:"China to Russia",consent:true,privacyVersion:"2026-07",locale:"en",startedAt:Date.now()}).success).toBe(false));
