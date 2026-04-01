import { AuthUser, User } from "../index";
import { Event } from "./event";

export interface DbAdapter {
  signup(
    agencySlug: string,
    email: string,
    passwordHash: string,
  ): Promise<User | { error: string }>;
  signin(
    agencySlug: string,
    email: string,
  ): Promise<AuthUser | { error: string }>;
  getAgencyUsers(agencyId: string): Promise<User[]>;
  getAgencyEvents(agencyId: string): Promise<Event[]>;
  createEvent(
    agencyId: string,
    name: string,
    artist: string,
    date: string,
    description: string,
  ): Promise<Event | { error: string }>;
}
