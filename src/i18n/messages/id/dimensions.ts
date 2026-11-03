import type { Messages } from "../types";

export const dimensions: Messages["dimensions"] = {
  risk_discipline: {
    name: "Disiplin Risiko",
    lowPole: "Sembrono",
    highPole: "Disiplin",
    short: "Risiko",
  },
  emotional_control: {
    name: "Kontrol Emosi",
    lowPole: "Mudah terbawa emosi",
    highPole: "Tenang",
    short: "Emosi",
  },
  independent_conviction: {
    name: "Keyakinan Mandiri",
    lowPole: "Bergantung",
    highPole: "Mandiri",
    short: "Keyakinan",
  },
  decisiveness: {
    name: "Ketegasan",
    lowPole: "Ragu-ragu",
    highPole: "Tegas",
    short: "Ketegasan",
  },
  consistency: {
    name: "Konsistensi",
    lowPole: "Gonta-ganti sistem",
    highPole: "Berkomitmen",
    short: "Konsistensi",
  },
  process_routine: {
    name: "Proses & Rutinitas",
    lowPole: "Asal jalan",
    highPole: "Berbasis rutinitas",
    short: "Proses",
  },
};
