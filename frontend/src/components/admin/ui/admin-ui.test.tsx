import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminDataTable } from "./admin-data-table";
import {
  AdminConfirmDialog,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminToast,
} from "./admin-feedback";
import { AdminFormField } from "./admin-form-field";
import { AdminPage } from "./admin-page";
import { AdminResponsiveList } from "./admin-responsive-list";
import { AdminStatus } from "./admin-status";
import { AdminToolbar } from "./admin-toolbar";

afterEach(cleanup);

describe("Admin UI primitives", () => {
  it("gives pages and toolbars a predictable semantic structure", () => {
    render(
      <AdminPage
        actions={<button type="button">新建服务</button>}
        description="管理官网服务内容"
        title="服务内容"
      >
        <AdminToolbar aria-label="内容筛选">
          <label htmlFor="search">搜索</label>
          <input id="search" />
        </AdminToolbar>
      </AdminPage>,
    );

    expect(screen.getByRole("heading", { name: "服务内容" })).toBeVisible();
    expect(screen.getByText("管理官网服务内容")).toBeVisible();
    expect(screen.getByRole("region", { name: "内容筛选" })).toBeVisible();
    expect(screen.getByRole("button", { name: "新建服务" })).toBeVisible();
  });

  it("translates workflow status without relying on color alone", () => {
    render(<AdminStatus status="review_pending" />);

    expect(screen.getByText("待审核")).toBeVisible();
    expect(screen.getByText("待审核")).toHaveAttribute(
      "data-status",
      "review_pending",
    );
  });

  it("connects required, help, count, and error copy to a form control", () => {
    render(
      <AdminFormField
        count={{ current: 8, maximum: 20 }}
        error="请输入服务名称"
        help="建议 4-20 个字"
        htmlFor="service-name"
        label="服务名称"
        required
      >
        <input id="service-name" />
      </AdminFormField>,
    );

    expect(screen.getByText("必填")).toBeVisible();
    expect(screen.getByText("建议 4-20 个字")).toBeVisible();
    expect(screen.getByText("8/20")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("请输入服务名称");
    expect(screen.getByLabelText("服务名称")).toHaveAttribute(
      "aria-describedby",
    );
    expect(screen.getByLabelText("服务名称")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("preserves control ARIA state and merges every description", () => {
    render(
      <>
        <p id="existing-help">已有说明</p>
        <AdminFormField
          count={{ current: 2, maximum: 10 }}
          help="补充说明"
          htmlFor="existing-field"
          label="已有字段"
        >
          <input
            aria-describedby="existing-help"
            aria-invalid="false"
            aria-required="true"
            id="existing-field"
          />
        </AdminFormField>
      </>,
    );

    const input = screen.getByLabelText("已有字段");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toEqual([
      "existing-help",
      "existing-field-help",
      "existing-field-count",
    ]);
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).toHaveAttribute("aria-required", "true");
  });

  it("renders a semantic desktop table and a readable mobile equivalent", () => {
    const rows = [{ id: "service-1", title: "海运服务", owner: "李华" }];
    const columns = [
      {
        hideOnMobile: true,
        key: "title",
        header: "内容名称",
        render: (row: typeof rows[number]) => row.title,
      },
      { key: "owner", header: "负责人", render: (row: typeof rows[number]) => row.owner },
    ];

    render(
      <AdminDataTable
        columns={columns}
        getRowKey={(row) => row.id}
        mobileLabel={(row) => row.title}
        mobileListLabel="服务内容列表"
        rows={rows}
        tableLabel="服务内容表格"
      />,
    );

    expect(screen.getByRole("table", { name: "服务内容表格" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "内容名称" })).toBeVisible();
    expect(screen.getAllByText("海运服务")).toHaveLength(2);
    expect(screen.getByRole("list", { name: "服务内容列表" })).toBeVisible();
    expect(screen.getByRole("table").parentElement).toHaveClass(
      "overflow-x-auto",
    );
  });

  it("supports custom responsive rows without losing list semantics", () => {
    render(
      <AdminResponsiveList
        aria-label="员工列表"
        getItemKey={(item) => item.id}
        items={[{ id: "staff-1", name: "王芳" }]}
        renderItem={(item) => <span>{item.name}</span>}
      />,
    );

    expect(screen.getByRole("list", { name: "员工列表" })).toBeVisible();
    expect(screen.getByRole("listitem")).toHaveTextContent("王芳");
  });

  it("provides Chinese loading, empty, error, toast, and confirmation feedback", () => {
    const retry = vi.fn();
    const confirm = vi.fn();
    const cancel = vi.fn();
    const { rerender } = render(<AdminLoadingState />);
    expect(screen.getByRole("status")).toHaveTextContent("正在加载");

    rerender(<AdminEmptyState description="创建第一条服务内容" title="暂无内容" />);
    expect(screen.getByText("暂无内容")).toBeVisible();

    rerender(<AdminErrorState onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(retry).toHaveBeenCalledOnce();

    rerender(<AdminToast message="草稿已保存" tone="success" />);
    expect(screen.getByRole("status")).toHaveTextContent("草稿已保存");

    rerender(
      <AdminConfirmDialog
        description="发布后官网访客将立即看到更新。"
        onCancel={cancel}
        onConfirm={confirm}
        open
        title="确认发布？"
      />,
    );
    expect(screen.getByRole("alertdialog", { name: "确认发布？" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("keeps confirmation focus inside the dialog and restores the trigger", () => {
    function ConfirmHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            打开确认
          </button>
          <AdminConfirmDialog
            description="发布后立即生效。"
            onCancel={() => setOpen(false)}
            onConfirm={() => undefined}
            open={open}
            title="确认发布"
          />
        </>
      );
    }

    render(<ConfirmHarness />);
    const trigger = screen.getByRole("button", { name: "打开确认" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("uses unique accessible IDs for simultaneous confirmation dialogs", () => {
    render(
      <>
        <AdminConfirmDialog
          description="第一条说明"
          onCancel={() => undefined}
          onConfirm={() => undefined}
          open
          title="第一条确认"
        />
        <AdminConfirmDialog
          description="第二条说明"
          onCancel={() => undefined}
          onConfirm={() => undefined}
          open
          title="第二条确认"
        />
      </>,
    );

    const first = screen.getByRole("alertdialog", { name: "第一条确认" });
    const second = screen.getByRole("alertdialog", { name: "第二条确认" });
    expect(first).not.toHaveAttribute(
      "aria-labelledby",
      second.getAttribute("aria-labelledby"),
    );
    expect(first).not.toHaveAttribute(
      "aria-describedby",
      second.getAttribute("aria-describedby"),
    );
  });
});
