const axios = require('axios');
const cheerio = require('cheerio');
const { createEvents } = require('ics');

// The council (South Norfolk) migrated its bin collection data away from the
// old ReCollect API to a bespoke ASP.NET service hosted on Azure. The service
// doesn't expose a simple JSON API; instead the collection calendar for a
// property (identified by its UPRN) has to be requested via a SOAP call and
// the result is an HTML calendar that needs to be parsed.
const BASE_URL = 'https://collections-southnorfolk.azurewebsites.net';
const COUNCIL_CODE = 'SNO';
// Change this to your own property's UPRN, e.g. by looking it up at
// https://collections-southnorfolk.azurewebsites.net/calendar.aspx
const UPRN = process.env.UPRN || '2630184867';

const BIN_TYPES = [
    { name: 'General Waste', keys: ['Ref date', 'Ref this'] },
    { name: 'Mixed Recycling', keys: ['Rec date', 'Rec this'] },
    { name: 'Garden Waste', keys: ['Grn date', 'Grn this'] },
    { name: 'Food Waste', keys: ['Food date', 'Fd date', 'Fod date', 'Food this', 'Fd this', 'Fod this'] }
];

const MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
];

function parseSetCookie(setCookieHeader) {
    if (!setCookieHeader) return '';
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return cookies.map((c) => c.split(';')[0]).join('; ');
}

async function fetchCalendarHtml() {
    // The service relies on a session cookie issued when loading the calendar
    // page, which must then be sent along with the SOAP request below.
    const pageResponse = await axios.get(`${BASE_URL}/calendar.aspx`, { timeout: 10000 });
    const cookie = parseSetCookie(pageResponse.headers['set-cookie']);

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getRoundCalendarForUPRN xmlns="http://webaspx-collections.azurewebsites.net/">
      <council>${COUNCIL_CODE}</council>
      <UPRN>${UPRN}</UPRN>
      <from>Chtml</from>
    </getRoundCalendarForUPRN>
  </soap:Body>
</soap:Envelope>`;

    const soapResponse = await axios.post(`${BASE_URL}/WSCollExternal.asmx`, soapBody, {
        timeout: 10000,
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            Cookie: cookie
        }
    });

    const $envelope = cheerio.load(soapResponse.data, { xmlMode: true });
    const encodedCalendar = $envelope('getRoundCalendarForUPRNResult').text();
    if (!encodedCalendar) {
        throw new Error('Could not find calendar data in council response.');
    }

    return encodedCalendar;
}

function extractBinDays(calendarHtml) {
    const $ = cheerio.load(calendarHtml);
    const binDays = [];

    $('table').each((_, table) => {
        const $table = $(table);
        const heading = $table.find('b').first().text().trim();
        const headingMatch = /^([A-Za-z]+)\s+(\d{4})$/.exec(heading);
        if (!headingMatch) return;

        const monthIndex = MONTHS.indexOf(headingMatch[1].toLowerCase());
        if (monthIndex === -1) return;
        const year = parseInt(headingMatch[2], 10);

        const firstOfMonth = new Date(year, monthIndex, 1);
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        // Calendar weeks start on Monday; convert JS's Sunday-based day index.
        const offset = (firstOfMonth.getDay() + 6) % 7;

        const rows = $table.find('tr').toArray();
        for (let rowIndex = 2; rowIndex < rows.length; rowIndex++) {
            const weekIndex = rowIndex - 2;
            const cells = $(rows[rowIndex]).find('td').toArray();

            for (let cellIndex = 1; cellIndex < cells.length; cellIndex++) {
                const columnIndex = cellIndex - 1;
                const day = weekIndex * 7 + columnIndex - offset + 1;
                if (day < 1 || day > daysInMonth) continue;

                const $cell = $(cells[cellIndex]);
                if ($cell.find('svg').length === 0) continue;

                const cellContent = $cell.html() || '';
                const matchedBins = BIN_TYPES.filter((bin) =>
                    bin.keys.some((key) => cellContent.toLowerCase().includes(key.toLowerCase()))
                );
                if (matchedBins.length === 0) continue;

                binDays.push({ date: new Date(year, monthIndex, day), bins: matchedBins });
            }
        }
    });

    return binDays;
}

exports.main = async (event, context) => {
    try {
        const calendarHtml = await fetchCalendarHtml();
        const binDays = extractBinDays(calendarHtml);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const events = [];
        for (const binDay of binDays) {
            if (binDay.date < today) continue;
            const [y, m, d] = [binDay.date.getFullYear(), binDay.date.getMonth() + 1, binDay.date.getDate()];
            for (const bin of binDay.bins) {
                events.push({
                    title: `${bin.name} Collection`,
                    start: [y, m, d],
                    description: `Put out your ${bin.name.toLowerCase()} bin.`,
                    alarms: [
                        {
                            action: 'display',
                            trigger: { hours: 24, before: true },
                            description: `Reminder: ${bin.name} Collection Tomorrow at Noon`
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
