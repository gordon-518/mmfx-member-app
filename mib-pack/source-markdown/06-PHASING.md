# 06 · Phasing

Four phases. The sequence is deliberate: the commercial conditions are settled before any
platform money is spent, and the pilot builds the real product rather than a demonstration
of it.

---

## Phase 0 — Agreement (now)

**What happens.** Dupoin and MMFX settle the commercial terms in `05` — the override, the
term, portability, and the three conditions. MMFX scopes the short foundation course.

**Exit criterion.** Condition 1 confirmed in writing: Dupoin commits to a sub-IB-level data
feed including lots traded, with a refresh cadence, and supplies baseline survival and
activity figures from the existing IB book.

**Why this gates everything.** Phase 1 is a substantial engineering investment made ahead
of any revenue. MMFX will make it — but not against an unverifiable outcome. If the data
does not exist, neither party can tell whether this worked, and the arrangement should not
start.

---

## Phase 1 — Build

**What happens.** The existing single-brand product is made multi-tenant:

- Tenant scoping across member data, with a full access-control pass
- Branding layer: per-tenant theme, logo, custom domain, email sender, document templating
- Per-tenant funnel configuration: broker routing, referral links, trial length
- Per-tenant feature toggles
- The upload-and-publish studio for IB content
- Tenant-scoped administration and analytics
- The neutral engine brand for the TradingView suite
- Production of the short foundation course

**What is deliberately not built.** Per-tenant content authoring beyond upload-and-publish,
the IB-facing portal, server-side conversion events, and the multi-tenant ad-account
structure. These are Phase 3, once the pilot has shown the model works.

**Risk, stated plainly.** This phase is built before the thesis is proven. That is a
considered decision: a co-branded pilot on the existing MMFX desk would have tested a
proxy, not the product, and would have produced a result neither party could trust. The
mitigation is Phase 0 — the conditions are settled first, and the build scope is held to
what three desks actually need.

---

## Phase 2 — Pilot

**Three IBs minimum. Sixty to ninety days.**

Three genuinely branded desks on shared infrastructure, each with their own content mix,
their own domain and their own traders. Real acquisition, real funded accounts, real
volume.

**Selection.** IBs with an existing audience and no product — that is the profile this is
built for, and the profile where the effect should be clearest. Ideally in different
markets, to avoid the overlap question in `05`.

**What is measured.**

| Metric | Why |
|---|---|
| Funded accounts per IB | Does the funnel convert |
| Lots per funded account per month | Does the desk increase activity |
| **90-day account survival vs Dupoin's baseline** | **The core claim.** Does the desk keep accounts alive |
| Trial-to-funded conversion rate | Funnel efficiency |
| Cost per funded account, where paid media is used | Whether Tier 3 can ever pay for itself |
| Support load per tenant | Whether the model scales operationally |

**Success.** Survival and lots per account measurably above Dupoin's baseline, at a support
and infrastructure cost per tenant that leaves the override profitable at scale.

**Failure is also a valid outcome.** If the desk does not move survival, that is worth
knowing after three tenants rather than thirty, and both parties should be able to say so.

---

## Phase 3 — Scale

**What happens.** Onboarding beyond the pilot cohort, against the minimum-volume threshold
and dormancy terms in `05`. The deferred build items come in as volume justifies them:
sub-IB attribution reporting, the IB-facing portal, server-side conversion events, the
short-form pipeline, and the multi-tenant ad-account structure that Tier 3 needs.

Tier 3 — MMFX running paid media — is entered deliberately and with a small number of IBs,
once Tier 1 has demonstrated that the desk produces volume without it.
