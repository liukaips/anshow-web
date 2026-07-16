import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

type FormControlProps = {
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

type AdminFormFieldProps = Readonly<{
  children: ReactElement<FormControlProps>;
  count?: Readonly<{ current: number; maximum: number }>;
  error?: string;
  help?: string;
  htmlFor: string;
  label: ReactNode;
  required?: boolean;
}>;

export function AdminFormField({
  children,
  count,
  error,
  help,
  htmlFor,
  label,
  required = false,
}: AdminFormFieldProps) {
  const helpId = help ? `${htmlFor}-help` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const countId = count ? `${htmlFor}-count` : undefined;
  const child = Children.only(children);
  const describedBy = [
    child.props["aria-describedby"],
    helpId,
    countId,
    errorId,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
  const control = isValidElement<FormControlProps>(child)
    ? cloneElement(child, {
        "aria-label":
          child.props["aria-label"] ??
          (typeof label === "string" ? label : undefined),
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : child.props["aria-invalid"],
        "aria-required": required ? true : child.props["aria-required"],
      })
    : child;

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-neutral-900" htmlFor={htmlFor}>
          {label}
          {required ? (
            <span
              aria-hidden="true"
              className="ml-2 text-xs font-normal text-red-700"
            >
              必填
            </span>
          ) : null}
        </label>
        {count ? (
          <span
            className="shrink-0 text-xs tabular-nums text-neutral-500"
            id={countId}
          >
            {count.current}/{count.maximum}
          </span>
        ) : null}
      </div>
      {control}
      {help ? (
        <p className="text-xs leading-5 text-neutral-600" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm leading-5 text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
