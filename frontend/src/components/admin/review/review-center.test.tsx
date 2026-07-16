import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const approve = vi.hoisted(() => vi.fn());
const reject = vi.hoisted(() => vi.fn());
vi.mock("../../../api/admin-reviews", () => ({ approveAdminReview: approve, rejectAdminReview: reject }));
import { ReviewCenter } from "./review-center";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const item = { id: "review-1", entityType: "services", entityId: "content-1", sourceVersion: 4, submittedBy: "editor-1", reviewerId: null, decision: "pending" as const, reason: null, submittedAt: "2026-07-15T04:00:00.000Z", decidedAt: null };

describe("ReviewCenter", () => {
  it("approves a versioned review and offers a content inspection link", async () => {
    approve.mockResolvedValue({ review: { ...item, decision: "approved" }, workflow: {} });
    render(<ReviewCenter initialItems={[item]} />);
    expect(screen.getByRole("link", { name: "检查三语内容" })).toHaveAttribute("href", "/admin/content/services/content-1");
    fireEvent.click(screen.getByRole("button", { name: "审核通过" }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("review-1", { expectedVersion: 4 }));
    expect(await screen.findByText("审核已通过")).toBeVisible();
  });
});
