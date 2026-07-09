// Request/response validation schemas (e.g. zod, shared with packages/shared-schemas).
//
// Register/login bodies are shared with the frontend via
// @lingumentor/shared-schemas — the signup and login forms validate with
// the exact same rules the gateway enforces. Refresh and logout take no
// body: the refresh token travels in an httpOnly cookie, never JSON.
export { loginBodySchema, type LoginBody, registerBodySchema, type RegisterBody } from "@lingumentor/shared-schemas";
