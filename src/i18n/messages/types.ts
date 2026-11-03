import type { en } from "./en";

/** Every leaf of the English dictionary, widened to string: the shape every locale must fill. */
type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

export type Messages = DeepString<typeof en>;
export type Namespace = keyof Messages;
