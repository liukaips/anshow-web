import { expect,it } from "vitest"; import { canTransition } from "./state-machine.js";
it("prevents spam directly becoming qualified",()=>expect(canTransition("spam","qualified")).toBe(false));
it("allows new to contacted",()=>expect(canTransition("new","contacted")).toBe(true));
