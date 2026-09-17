/// The three fixed demo identities (D-02, inherited from my-besu-net). Not a
/// stand-in for a real user table — v1 has exactly these three.
export type Identity = "admin" | "anson" | "beatrice";

export const IDENTITIES: readonly Identity[] = ["admin", "anson", "beatrice"];

export function isIdentity(value: unknown): value is Identity {
  return typeof value === "string" && (IDENTITIES as readonly string[]).includes(value);
}
