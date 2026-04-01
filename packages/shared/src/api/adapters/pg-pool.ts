import { AuthUser, User, Event, DbAdapter } from "../../core";
import { getPgPool } from "../../db";

export function createPgPoolAdapter(
  dbUrl: string,
  isWorker: boolean = false,
): DbAdapter {
  let pool;

  if (isWorker) {
    pool = getPgPool(dbUrl, 5);
  } else {
    pool = getPgPool(dbUrl);
  }

  return {
    async signup(agencySlug, email, passwordHash) {
      const client = await pool.connect();
      try {
        const { rows } = await client.query<User>(
          "select * from create_user_fn($1, $2, $3)",
          [email, passwordHash, agencySlug],
        );
        return rows[0] ?? { error: "signup_failed" };
      } catch (error: any) {
        if (error.message?.includes("invalid_agency"))
          return { error: "invalid_agency" };
        throw error;
      } finally {
        client.release();
      }
    },

    async signin(agencySlug, email) {
      const client = await pool.connect();
      try {
        const { rows } = await client.query<AuthUser>(
          "select * from signin_fn($1, $2)",
          [email, agencySlug],
        );
        return rows[0] ?? { error: "invalid_email" };
      } catch (error: any) {
        if (error.message?.includes("invalid_agency"))
          return { error: "invalid_agency" };
        throw error;
      } finally {
        client.release();
      }
    },

    async getAgencyUsers(agencyId) {
      const client = await pool.connect();
      try {
        const { rows } = await client.query<User>(
          "select * from get_agency_users_fn($1)",
          [agencyId],
        );
        return rows;
      } finally {
        client.release();
      }
    },

    async getAgencyEvents(agencyId) {
      const client = await pool.connect();
      try {
        const { rows } = await client.query<Event>(
          "select * from get_agency_events_fn($1)",
          [agencyId],
        );
        return rows;
      } finally {
        client.release();
      }
    },

    async createEvent(agencyId, name, artist, date, description) {
      const client = await pool.connect();
      try {
        const { rows } = await client.query<Event>(
          "select * from create_event_fn($1, $2, $3, $4, $5)",
          [agencyId, name, artist, date, description],
        );
        return rows[0] ?? { error: "create_event_failed" };
      } catch (error: any) {
        if (error.message?.includes("invalid_agency"))
          return { error: "invalid_agency" };
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
