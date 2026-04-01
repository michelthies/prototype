import { User, AuthUser, Event, DbAdapter } from "../../core";

export function createPostgrestAdapter(
  postgrestUrl: string,
  token?: string,
): DbAdapter {
  async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${postgrestUrl}/rpc/${fn}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`${res.status}${res.text()}`);
    }

    return (await res.json()) as T;
  }

  return {
    async signup(agencySlug, email, passwordHash) {
      const rows = await rpc<User[]>("create_user_fn", {
        p_email: email,
        p_password_hash: passwordHash,
        p_agency_slug: agencySlug,
      });
      return rows[0] ?? { error: "signup_failed" };
    },

    async signin(agencySlug, email) {
      const rows = await rpc<AuthUser[]>("signin_fn", {
        p_email: email,
        p_agency_slug: agencySlug,
      });
      return rows[0] ?? { error: "invalid_email" };
    },

    async getAgencyUsers(agencyId) {
      return rpc<User[]>("get_agency_users_fn", { p_agency_id: agencyId });
    },

    async getAgencyEvents(agencyId) {
      return rpc<Event[]>("get_agency_events_fn", { p_agency_id: agencyId });
    },

    async createEvent(agencyId, name, artist, date, description) {
      const rows = await rpc<Event[]>("create_event_fn", {
        p_agency_id: agencyId,
        p_name: name,
        p_artist: artist,
        p_date: date,
        p_description: description,
      });
      return rows[0] ?? { error: "create_event_failed" };
    },
  };
}
