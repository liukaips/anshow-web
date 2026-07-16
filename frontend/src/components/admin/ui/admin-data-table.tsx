import type { ReactNode } from "react";

import { AdminResponsiveList } from "./admin-responsive-list";

export type AdminDataTableColumn<Row> = Readonly<{
  className?: string;
  header: ReactNode;
  hideOnMobile?: boolean;
  key: string;
  render: (row: Row) => ReactNode;
}>;

type AdminDataTableProps<Row> = Readonly<{
  columns: readonly AdminDataTableColumn<Row>[];
  getRowKey: (row: Row) => string;
  mobileLabel: (row: Row) => ReactNode;
  mobileListLabel: string;
  rows: readonly Row[];
  tableLabel: string;
}>;

export function AdminDataTable<Row>({
  columns,
  getRowKey,
  mobileLabel,
  mobileListLabel,
  rows,
  tableLabel,
}: AdminDataTableProps<Row>) {
  return (
    <div className="min-w-0 border border-neutral-200 bg-white">
      <div className="hidden overflow-x-auto md:block">
        <table
          aria-label={tableLabel}
          className="w-full min-w-max border-collapse text-left text-sm"
        >
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              {columns.map((column) => (
                <th
                  className={`border-b border-neutral-200 px-4 py-3 font-medium ${column.className ?? ""}`}
                  key={column.key}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-neutral-800">
            {rows.map((row) => (
              <tr
                className="transition-colors hover:bg-neutral-50"
                key={getRowKey(row)}
              >
                {columns.map((column) => (
                  <td
                    className={`px-4 py-3 align-middle ${column.className ?? ""}`}
                    key={column.key}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminResponsiveList
        aria-label={mobileListLabel}
        className="md:hidden"
        getItemKey={getRowKey}
        items={rows}
        renderItem={(row) => (
          <div className="grid min-w-0 gap-3">
            <div className="font-medium text-neutral-950">{mobileLabel(row)}</div>
            <dl className="grid min-w-0 gap-2 text-sm">
              {columns.filter((column) => !column.hideOnMobile).map((column) => (
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3" key={column.key}>
                  <dt className="text-neutral-500">{column.header}</dt>
                  <dd className="min-w-0 text-neutral-800">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      />
    </div>
  );
}
