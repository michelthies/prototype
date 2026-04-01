import { layout } from "../layout";

export function signupPage(agencySlug: string): string {
  return layout(
    "Sign Up",
    `<h1>Sign Up</h1>
    <form hx-post="/${agencySlug}/api/signup" hx-ext="json-enc" hx-target="#result" hx-swap="innerHTML" hx-on::after-request="if(event.detail.successful) window.location.href='/${agencySlug}/agency'">
      <div>
        <label>Email<br><input type="email" name="email" required></label>
      </div>
      <div>
        <label>Password<br><input type="password" name="password" required minlength="8"></label>
      </div>
      <button type="submit">Sign Up</button>
    </form>
    <div id="result"></div>`,
    agencySlug
  );
}
