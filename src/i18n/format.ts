// Interpolation for message templates: "Day {day} · {stage}".
//
// Messages are plain strings with {name} placeholders. A placeholder with no
// value is left visible rather than blanked, so a missing variable shows up
// in review instead of silently producing a sentence with a hole in it.

export type Vars = Record<string, string | number>;

export function fmt(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
  );
}

/**
 * English needs "1 lesson" / "2 lessons"; Chinese, Malay and Indonesian don't
 * inflect, so their "one" and "other" messages are simply the same string.
 */
export function plural(n: number, one: string, other: string, vars?: Vars): string {
  return fmt(n === 1 ? one : other, { n, ...vars });
}
