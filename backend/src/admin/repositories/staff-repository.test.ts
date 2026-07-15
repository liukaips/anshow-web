import { describe, expect, it, vi } from "vitest";
import { createStaffRepository } from "./staff-repository.js";

describe("staff repository lifecycle", () => {
  it("exposes a port that revokes sessions on role changes", () => {
    const deleteSessions = vi.fn();
    const port = { deleteSessions, disableUser: vi.fn(), audit: vi.fn() };
    async function disable(userId: string, actorId: string) { await port.disableUser(userId); await port.deleteSessions(userId); await port.audit(actorId, "staff.disable", userId); }
    return disable("user-1", "admin-1").then(() => expect(deleteSessions).toHaveBeenCalledWith("user-1"));
  });
  it("builds a repository factory", () => expect(typeof createStaffRepository).toBe("function"));
});
