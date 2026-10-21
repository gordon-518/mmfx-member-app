export type ArchetypeId =
  | 'reckless_gambler'
  | 'analysis_paralyser'
  | 'signal_dependent'
  | 'indicator_stacker'
  | 'emotional_revenge_trader'
  | 'news_trader'
  | 'system_hopper'
  | 'brand_new_beginner';

export type Tier = 'free' | 'team_mm' | 'mentorship';

export interface MMFXPath {
  resources: string[];
  tier: Tier;
  cta_text: string;
}

/** A deep-link button into a member-app section, chosen from the trader's profile. */
export interface Keystone {
  /** Member-app route, e.g. "/course". Must be an allowlisted internal path. */
  path: string;
  label: string;
  why: string;
}

export interface ArchetypeProfile {
  id: ArchetypeId;
  name: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  common_mistakes: string[];
  focus: string[];
  mmfx_path: MMFXPath;
  /** Primary "next move" button for this archetype (the keystone fix). */
  keystone: Keystone;
}

// ---------------------------------------------------------------------------
// Dimensional profile — six spectra, all oriented "higher = healthier".
// ---------------------------------------------------------------------------

export type DimensionId =
  | 'risk_discipline'
  | 'emotional_control'
  | 'independent_conviction'
  | 'decisiveness'
  | 'consistency'
  | 'process_routine';

export interface Dimension {
  id: DimensionId;
  name: string;
  /** Unhealthy pole (left / the leak). */
  lowPole: string;
  /** Healthy pole (right / the goal). */
  highPole: string;
}

/** Normalized 0–100 score per dimension. */
export type DimensionScores = Record<DimensionId, number>;

export interface AnswerOption {
  id: string;
  text: string;
  scoring: Partial<Record<ArchetypeId, number>>;
  /** Signed deltas this option contributes to each dimension (higher = healthier). */
  dimensions?: Partial<Record<DimensionId, number>>;
}

export interface Question {
  id: string;
  text: string;
  /** Short thematic label shown as the question eyebrow (e.g. "Risk & Sizing"). */
  theme?: string;
  options: AnswerOption[];
}

export type UserAnswers = Record<string, string>;

/** A resolved "next move" button rendered at the end of the report. */
export interface Move extends Keystone {
  primary: boolean;
}

export interface GenerateReportRequest {
  archetype: ArchetypeId;
  answers: UserAnswers;
}

export interface GenerateReportResponse {
  report_text: string;
  archetype: ArchetypeId;
  dimensions: DimensionScores;
  moves: Move[];
  generated_at: string;
}

export interface VoiceSample {
  context: string;
  text: string;
}
