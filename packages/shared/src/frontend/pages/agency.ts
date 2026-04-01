import { layout } from "../layout";

export function agencyPage(agencySlug: string): string {
  return layout(
    "Agency",
    `
    <h1>Agency</h1>
    <div hx-get="/${agencySlug}/api/authenticated/agency" hx-trigger="load" hx-target="#users" hx-swap="innerHTML">
      <div id="users"></div>
    </div>
    <form hx-post="/${agencySlug}/api/signout" hx-on::after-request="if(event.detail.successful) window.location.href='/${agencySlug}'">
      <button type="submit">Logout</button>
    </form>
    `,
    agencySlug
  );
}
