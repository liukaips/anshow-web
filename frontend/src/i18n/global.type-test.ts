import type { Locale, Messages } from "next-intl";

import type { SupportedLocale } from "../lib/app-config";
import type english from "./messages/en.json";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() =>
    Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

export type LocaleMatchesApplication = Expect<Equal<Locale, SupportedLocale>>;
export type MessagesMatchEnglishSchema = Expect<
  Equal<Messages, typeof english>
>;
