import { layout } from "../layout";

export function signinPage(agencySlug: string): string {
  return layout(
    "Sign In",
    `<h1>Sign In</h1>
    <form hx-post="/${agencySlug}/api/signin" hx-ext="json-enc" hx-target="#result" hx-swap="innerHTML" hx-on::after-request="if(event.detail.successful) window.location.href='/${agencySlug}/agency'">
      <div>
        <label>Email<br><input type="email" name="email" required></label>
      </div>
      <div>
        <label>Password<br><input type="password" name="password" required></label>
      </div>
      <button type="submit">Sign In</button>
    </form>
    <div id="result"></div>`,
    agencySlug
  );
}
