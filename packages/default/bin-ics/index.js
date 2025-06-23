const axios = require('axios');
const { createEvents } = require('ics');

const BIN_API_URL = 'https://api.eu.recollect.net/api/places/87A07616-3F72-11ED-B420-1F18C07B2040/services/4/events?hide=reminder_only&client_id=E3E82C4E-BD50-11EF-BE90-89121E7D33AC&nomerge=true&locale=en-GB&after=2025-06-01&before=2026-06-01&_=175070066Y';

exports.main = async (event, context) => {
    try {
        const { data } = await axios.get(BIN_API_URL, { timeout: 10000 });
        const events = [];

        for (const e of data.events) {
            if (!e.is_approved) continue;
            const dateStr = e.day;
            for (const flag of e.flags) {
                const binType = flag.subject || flag.name || 'Bin';
                const [y, m, d] = dateStr.split('-').map(Number);
                events.push({
                    title: `${binType} Collection`,
                    start: [y, m, d],
                    description: flag.html_message?.replace(/<\/?[^>]+(>|$)/g, '') || `Put out your ${binType.toLowerCase()} bin.`,
                    alarms: [
                        {
                            action: 'display',
                            trigger: { hours: 24, before: true },
                            description: `Reminder: ${binType} Collection Tomorrow at Noon`
                        }
                    ]
                });
            }
        }

        if (!events.length) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'text/plain' },
                body: 'No bin collections found in API.',
            };
        }

        const { error, value } = createEvents(events);
        if (error) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'text/plain' },
                body: 'ICS error: ' + JSON.stringify(error)
            };
        }

        // Patch the ICS output to mark events as FREE/TRANSPARENT
        const valuePatched = value.replace(
            /BEGIN:VEVENT/g,
            'BEGIN:VEVENT\nTRANSP:TRANSPARENT\nX-MICROSOFT-CDO-BUSYSTATUS:FREE'
        );

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/calendar',
                'Content-Disposition': 'inline; filename="bin-collections.ics"',
                'Cache-Control': 'max-age=3600'
            },
            body: valuePatched
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/plain' },
            body: 'Error generating calendar: ' + err.toString()
        };
    }
};
