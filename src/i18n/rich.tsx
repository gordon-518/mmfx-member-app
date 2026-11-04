import { Fragment, type ReactNode } from "react";

/**
 * A message with React nodes in it: rich("We sent a code to {email}.", {
 * email: <b>{address}</b> }). Word order differs between languages — Chinese
 * puts the email somewhere else in the sentence than English does — so the
 * translation decides where each node goes, not the component.
 */
export function rich(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name && name in nodes ? <Fragment key={i}>{nodes[name]}</Fragment> : part;
  });
}
