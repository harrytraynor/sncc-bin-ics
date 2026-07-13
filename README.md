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

No database is required. Place the function behind a CDN-enabled custom domain:
its `Cache-Control` header caches the feed for 12 hours by default and serves stale
content for up to one day when the origin is unavailable. Set `CACHE_TTL_SECONDS`
to a value between 21600 and 86400 to change the CDN cache period. Calendar clients
can revalidate with the CDN rather than retaining their own cached copy, so
schedule changes are picked up promptly without sending every request to the function;
the exact client-cache behavior depends on the calendar application.

Structured metrics are written to function logs for cache misses, upstream failures,
empty calendars, refresh latency, and execution time. Create DigitalOcean log alerts
for `upstream_error` and `empty_calendar`, and monitor `function_duration_ms`.

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
