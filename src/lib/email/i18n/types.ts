import type { en } from "./en";

/** Every leaf of the English email dictionary, widened to string: the shape every locale fills. */
type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

export type EmailMessages = DeepString<typeof en>;
