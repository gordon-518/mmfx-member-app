// Starting the tour from anywhere: the overlay lives inside AppShell (it needs
// the sidebar and, on a phone, the drawer), and the buttons that start it live
// on pages. A window event is the smallest thing that joins them without
// threading state through every page.

export const TOUR_EVENT = "mmfx:start-tour";

export function startTour(): void {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT));
}
