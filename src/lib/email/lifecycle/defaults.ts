// The control arm's copy, read off the templates themselves.
//
// Arm 'A' lives in code (spec §2: hybrid — code holds the default, the
// database holds approved challengers). Every template exports
// `defaultCopy: LifecycleCopy` alongside its builder, and the metrics route
// hands that to the brain so a proposal is written against the words the
// reader actually got, not against a copy of them kept somewhere else.
//
// The lookup is deliberately tolerant: a template that has not yet been
// restructured onto LifecycleCopy simply has no `defaultCopy`, and the route
// reports null for its 'A' arm rather than failing the whole request.

import type { LifecycleCopy } from "./types";
import * as analysis from "./templates/analysis";
import * as brokerClicked from "./templates/broker-clicked";
import * as day12 from "./templates/day12";
import * as digest from "./templates/digest";
import * as kys from "./templates/kys";
import * as ladder from "./templates/ladder";
import * as lesson1 from "./templates/lesson1";
import * as memberD3 from "./templates/member-d3";
import * as memberD7 from "./templates/member-d7";
import * as memberDormant from "./templates/member-dormant";
import * as spotlight from "./templates/spotlight";
import * as tv from "./templates/tv";
import * as upgradeSeen from "./templates/upgrade-seen";
import * as welcome from "./templates/welcome";

type CopyModule = { defaultCopy?: LifecycleCopy };

const MODULES = {
  trial: { welcome, analysis, kys, tv, lesson1, ladder, day12 },
  nurture: { digest, spotlight },
  rescue: { "upgrade-seen": upgradeSeen, "broker-clicked": brokerClicked },
  member: { "member-d3": memberD3, "member-d7": memberD7, "member-dormant": memberDormant },
} as unknown as Record<string, Record<string, CopyModule>>;

/** The template's own copy for a (flow, step), or null if it exports none. */
export function defaultCopyFor(flow: string, step: string): LifecycleCopy | null {
  return MODULES[flow]?.[step]?.defaultCopy ?? null;
}
