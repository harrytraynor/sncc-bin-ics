# Bin Collection ICS Calendar API

Automatically generate a live .ics calendar feed for your local bin collection schedule, using South Norfolk Council's bin collection calendar service.  
Deployable as a DigitalOcean Function (Node.js 22).

## Features
- **Live .ics feed** — always up to date from the council’s API.
- **Supports all bin types** (recycling, rubbish, garden, etc).
- **Events are marked as Free/Transparent** (don’t block your calendar).
- **24-hour advance reminders** before every collection day.

## Usage
1. **Deploy as a DigitalOcean serverless function**  
   - Use the Node.js 22 runtime.
   - No extra build tools required.

2. **Configure your calendar client**  
   - Subscribe to the function’s URL as a calendar feed (`.ics`).
   - Events will automatically appear and update.

## API Endpoint
The function serves an `.ics` file at: GET /default/bin-ics
(Adjust path as per your deployment.)

## Environment
- Node.js 22
- No secrets required; reads public council API.

### Performance and resilience

Set `REDIS_URL` to the TLS connection URL for a DigitalOcean Managed Redis database
(normally `rediss://...`). The function caches each UPRN's rendered ICS feed for 12
hours by default, so cache hits do not call the council service. Set
`CACHE_TTL_SECONDS` to a value between 21600 and 86400 to change that period.

The cache key is scoped by UPRN. Redis records are retained after their freshness
period; if a refresh fails, the last valid feed is served with `X-Cache: STALE`.
If Redis is unavailable, the function continues to generate feeds directly.

The response includes `ETag` and `Last-Modified`, allowing calendar clients to
revalidate without downloading unchanged content. Its `Cache-Control` header is
configured for a DigitalOcean CDN: place the function behind a CDN-enabled custom
domain, which will cache the feed for the same TTL and serve stale content for up to
one day when the origin is unavailable.

Structured metrics are written to function logs for cache hits/misses, stale-cache
responses, upstream failures, empty calendars, refresh latency, and execution time.
Create DigitalOcean log alerts for `upstream_error`, `empty_calendar`, and
`stale_cache_served`, and monitor `function_duration_ms` and `cache_hit`.

## Example Output
- Calendar events for all bin collection dates (all-day)
- Each event has a 24-hour prior reminder
- Events are “free” (do not show as busy in Outlook/Google Calendar)

## Configuration
If you need to change property or date range, edit the `UPRN` constant in the function code (or set it via the `UPRN` environment variable). Find your UPRN by looking up your address at https://collections-southnorfolk.azurewebsites.net/calendar.aspx.

## Caveats
- Reminders on all-day events will fire at **midnight** the day before (ICS limitation).
- For a noon reminder, switch events to timed instead of all-day (not recommended).

## License
MIT. Use at your own risk. Not affiliated with South Norfolk Council.
