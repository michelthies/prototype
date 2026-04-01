import { layout } from "../layout";

export function eventsPage(agencySlug: string): string {
  return layout(
    "Events",
    `
    <h1>Events</h1>
    <div hx-get="/${agencySlug}/api/authenticated/events" hx-trigger="load" hx-target="#events" hx-swap="innerHTML">
      <div id="events"></div>
    </div>
    <form hx-post="/${agencySlug}/api/signout" hx-on::after-request="if(event.detail.successful) window.location.href='/${agencySlug}'">
      <button type="submit">Logout</button>
    </form>
    `,
    agencySlug
  );
}
