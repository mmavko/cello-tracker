# Cello Tracker

Automatic cello-practice tracker: open it on your phone, tap Start, play — it times
you only while it hears the cello (mic + Wake Lock API, screen stays on). Growing
from a bare timer into a daily-practice **motivator** for a child — Duolingo-style
streaks and a points-fed "collection" that compounds — with the detector as its
sensing layer.

Live at **https://cello.mavko.consulting**

## Layout

```
app/            the web app — static files, no build step ("/" main, "/settings" tuning)
docs/           design — detection pipeline, platform patterns, main-app-* docs
test/           node --test suite (npm test)
chronicles.md   the project's memory — status, decisions, what was tried and killed
```

Two framework-free engines kept pure and reusable — the cello **detector** and the
**motivation** engine — with thin UI over them. For the file-by-file map see
[docs/README.md](docs/README.md); for how anything works or why, start with
`chronicles.md` and `docs/`.

## Deploy

```
./deploy.sh
```

Deploys `app/` to Cloudflare Pages (project `cello-tracker`). The script stamps
`?v=<build>` onto every script/import URL so a normal browser reload always gets the
latest — CF caches JS for 4h otherwise and a page-URL query can't bust sub-resources.
The build stamp shows in the Home footer (next to ⚙) so you can confirm you're
current. `app/_headers` keeps the HTML always-revalidated. The app source stays
build-free; the stamping is a `cp` + `sed` at deploy time only.

Custom domains: use the Cloudflare dashboard (Pages → project → Custom domains) — the
API registers the domain but does not auto-create the CNAME record.
