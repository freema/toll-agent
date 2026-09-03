# Security

## Reporting

Open a [GitHub security advisory](https://github.com/freema/toll-agent/security/advisories/new), or an
issue if it is not sensitive. There is no service to take down and no user database to breach — the
realistic problems are local ones.

## What this project handles

- **Licence plates.** They exist in the running process, and on disk only in a journal file if one is
  enabled. `.gitignore` excludes journals and browser profiles.
- **Card details: never.** The tool stops at the payment gateway. It has no card storage and no code
  path that submits a payment. See [docs/adr/0002-no-payment.md](docs/adr/0002-no-payment.md).
- **Credentials: none.** `check` is read-only and unauthenticated. If a future adapter needs a portal
  login, that session belongs to the user's own browser profile, not to this tool.

## Things worth knowing before you run it

- **Browser automation runs against your real profile.** That is deliberate — real session, real
  fingerprint, 3DS in your own tab — but it also means the tool can see whatever that profile can see.
  Use the dedicated profile the setup instructions describe.
- **Chrome ≥ 136 refuses `--remote-debugging-port` over the default user data directory.** This is a
  defence against cookie theft, not a bug to work around. Use a dedicated profile.
- **A URL is only trustworthy if it came out of `data/`.** The allowlist is enforced by a test. If you
  ever see this tool link something that is not an official state portal, that is a security bug —
  report it as one.

## Threat we take seriously

Someone forking this project, adding an affiliate link, and publishing it under a similar name. The
defence is the same as the product: the official portal list is data, sourced and dated, and the test
suite fails on any host outside it. If you are looking at a fork, check `data/portals.json` and check
that `test/data.test.ts` still exists.
