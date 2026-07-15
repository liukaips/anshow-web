export type InquiryStatus = "new"|"contacted"|"qualified"|"closed"|"spam";
const transitions: Record<InquiryStatus, readonly InquiryStatus[]> = {new:["contacted","qualified","closed","spam"],contacted:["qualified","closed","spam"],qualified:["contacted","closed","spam"],closed:["contacted"],spam:["new"]};
export function canTransition(from: InquiryStatus,to: InquiryStatus){return transitions[from]?.includes(to)??false;}
