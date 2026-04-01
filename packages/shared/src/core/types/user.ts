export interface User {
  id: string;
  email: string;
  agency_id: string;
  name?: string;
}

export interface AuthUser {
  id: string;
  password_hash: string;
  agency_id: string;
  agency_slug: string;
}
