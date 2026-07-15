// Lint config note: this app stays on ESLint 8 + .eslintrc.json (legacy
// config) rather than ESLint 9's flat config. Verified against the
// installed `next` version (14.2.35, see node_modules/next/dist/lib/eslint/
// runLintCheck.js) — `next lint` still resolves config via findup over
// [.eslintrc.js, .eslintrc.cjs, .eslintrc.yaml, .eslintrc.yml, .eslintrc.json,
// .eslintrc] and constructs ESLint with `useEslintrc: true` (the legacy
// CLIEngine-style API); there's no eslint.config.js detection anywhere in
// that code path. Flat-config support for `next lint` didn't land until
// Next 15 — bumping ESLint here would just make `next lint` unable to find
// a config at all, the same failure mode this whole file exists to fix.
/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA config, image domains (R2/Cloudflare), etc. go here.
};

module.exports = nextConfig;
