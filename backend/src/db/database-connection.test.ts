import { describe, expect, it, vi } from "vitest";

import { configureOpenedDatabase } from "./database-connection.js";

describe("configureOpenedDatabase", () => {
  it("applies the application pragmas in order", () => {
    const connection = {
      pragma: vi.fn(),
      close: vi.fn(),
    };

    expect(configureOpenedDatabase(connection)).toBe(connection);
    expect(connection.pragma.mock.calls).toEqual([
      ["journal_mode = WAL"],
      ["foreign_keys = ON"],
      ["busy_timeout = 5000"],
    ]);
    expect(connection.close).not.toHaveBeenCalled();
  });

  it("closes the opened connection when pragma configuration fails", () => {
    const failure = new Error("pragma failed");
    const connection = {
      pragma: vi.fn((pragma: string) => {
        if (pragma === "foreign_keys = ON") throw failure;
      }),
      close: vi.fn(),
    };

    expect(() => configureOpenedDatabase(connection)).toThrow(failure);
    expect(connection.pragma.mock.calls).toEqual([
      ["journal_mode = WAL"],
      ["foreign_keys = ON"],
    ]);
    expect(connection.close).toHaveBeenCalledOnce();
  });
});
