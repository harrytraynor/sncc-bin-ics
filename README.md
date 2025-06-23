# Bin Collection ICS Calendar API

Automatically generate a live .ics calendar feed for your local bin collection schedule, using the South Norfolk (ReCollect) waste API.  
Deployable as a DigitalOcean Function (Node.js 18).

## Features
- **Live .ics feed** — always up to date from the council’s API.
- **Supports all bin types** (recycling, rubbish, garden, etc).
- **Events are marked as Free/Transparent** (don’t block your calendar).
- **24-hour advance reminders** before every collection day.

## Usage
1. **Deploy as a DigitalOcean serverless function**  
   - Use Node.js 18 runtime.
   - No extra build tools required.

2. **Configure your calendar client**  
   - Subscribe to the function’s URL as a calendar feed (`.ics`).
   - Events will automatically appear and update.

## API Endpoint
The function serves an `.ics` file at: GET /default/bin-ics
(Adjust path as per your deployment.)

## Environment
- Node.js 18
- No secrets required; reads public council API.

## Example Output
- Calendar events for all bin collection dates (all-day)
- Each event has a 24-hour prior reminder
- Events are “free” (do not show as busy in Outlook/Google Calendar)

## Configuration
If you need to change area or date range, edit `BIN_API_URL` in the function code.

## Caveats
- Reminders on all-day events will fire at **midnight** the day before (ICS limitation).
- For a noon reminder, switch events to timed instead of all-day (not recommended).

## License
MIT. Use at your own risk. Not affiliated with South Norfolk Council.
