import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import type { PermissionKey } from "../../auth/permissions.js";
import type { AppEnv } from "../../http/context.js";
import {
  StaffRepositoryError,
  type StaffRepository,
} from "../repositories/staff-repository.js";
import { registerStaffRoutes } from "./staff.js";

function repository(): StaffRepository {
  return {
    list: vi.fn(() => [
      {
        id: "editor-1",
        name: "张敏",
        email: "editor@example.test",
        enabled: true,
        createdAt: new Date("2026-07-16T08:00:00.000Z"),
        roles: "Content Editor",
        roleIds: ["content-editor"],
        roleNames: ["Content Editor"],
        isSuperAdmin: false,
      },
    ]),
    get: vi.fn(() => null),
    listRoles: vi.fn(() => []),
    create: vi.fn(async () => ({
      id: "11111111-1111-4111-8111-111111111111" as `${string}-${string}-${string}-${string}-${string}`,
      name: "刘凯",
      email: "liukai@anshow.local",
      enabled: true,
      createdAt: new Date("2026-07-19T13:00:00.000Z"),
      roles: "System Administrator",
      roleIds: ["system-administrator"],
      roleNames: ["System Administrator"],
      isSuperAdmin: false,
    })),
    disable: vi.fn(),
    enable: vi.fn(),
    setRoles: vi.fn(),
    revokeSessions: vi.fn(),
  };
}

function app(
  staffRepository: StaffRepository,
  permissionKeys: PermissionKey[] = ["staff.manage"],
) {
  const application = new OpenAPIHono<AppEnv>();
  application.use("*", async (context, next) => {
    context.set("requestId", "request-staff-1");
    await next();
  });
  registerStaffRoutes(application, staffRepository, {
    getPermissions: () => permissionKeys,
    getSession: async () => ({
      user: { id: "admin-1", email: "admin@example.test" },
    }),
  });
  return application;
}

describe("admin staff routes", () => {
  it("returns operational staff state without duplicate role rows", async () => {
    const response = await app(repository()).request("/api/admin/staff");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [
        {
          id: "editor-1",
          enabled: true,
          roleIds: ["content-editor"],
          roleNames: ["Content Editor"],
          isSuperAdmin: false,
        },
      ],
    });
  });

  it("requires staff.manage before forced sign-out", async () => {
    const staffRepository = repository();
    const response = await app(staffRepository, []).request(
      "/api/admin/staff/editor-1/sessions/revoke",
      { method: "POST" },
    );

    expect(response.status).toBe(403);
    expect(staffRepository.revokeSessions).not.toHaveBeenCalled();
  });

  it("creates a staff account with the authenticated actor", async () => {
    const staffRepository = repository();
    const response = await app(staffRepository).request("/api/admin/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        account: "liukai",
        name: "刘凯",
        password: "liukaiok",
        roleIds: ["system-administrator"],
      }),
    });

    expect(response.status).toBe(201);
    expect(staffRepository.create).toHaveBeenCalledWith(
      {
        account: "liukai",
        name: "刘凯",
        password: "liukaiok",
        roleIds: ["system-administrator"],
      },
      "admin-1",
    );
    expect(await response.json()).toMatchObject({
      data: { email: "liukai@anshow.local", enabled: true },
    });
  });

  it("revokes sessions with the authenticated actor", async () => {
    const staffRepository = repository();
    const response = await app(staffRepository).request(
      "/api/admin/staff/editor-1/sessions/revoke",
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(staffRepository.revokeSessions).toHaveBeenCalledWith(
      "editor-1",
      "admin-1",
    );
  });

  it("returns Chinese recovery guidance for protected administrators", async () => {
    const staffRepository = repository();
    vi.mocked(staffRepository.disable).mockImplementation(() => {
      throw new StaffRepositoryError(
        "LAST_SUPER_ADMIN",
        "系统必须保留至少一名正常使用的超级管理员",
      );
    });

    const response = await app(staffRepository).request(
      "/api/admin/staff/editor-1/disable",
      { method: "POST" },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: {
        code: "LAST_SUPER_ADMIN",
        message: "系统必须保留至少一名正常使用的超级管理员",
      },
    });
  });
});
