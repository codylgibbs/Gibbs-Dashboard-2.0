// Debug script to fetch and inspect Family calendar for Feb 26, 2026
const familyCalendarUrl = 'https://calendar.google.com/calendar/ical/irle9u76p2eedb3pukltn49lvgcf1apf%40import.calendar.google.com/public/basic.ics';

async function fetchAndInspect() {
  try {
    console.log('Fetching Family calendar...');
    const response = await fetch(familyCalendarUrl);
    const data = await response.text();
    
    // Extract events for Feb 26
    const lines = data.split('\n');
    let currentEvent = {};
    let inEvent = false;
    const febEvents = [];
    
    for (const line of lines) {
      if (line.includes('BEGIN:VEVENT')) {
        inEvent = true;
        currentEvent = {};
      } else if (line.includes('END:VEVENT')) {
        inEvent = false;
        const startLine = lines.find(l => l.includes('DTSTART'));
        if (currentEvent.summary && currentEvent.dtstart) {
          febEvents.push(currentEvent);
        }
      } else if (inEvent) {
        if (line.startsWith('SUMMARY:')) {
          currentEvent.summary = line.substring(8);
        } else if (line.startsWith('DTSTART')) {
          currentEvent.dtstart = line;
        } else if (line.startsWith('DTEND')) {
          currentEvent.dtend = line;
        } else if (line.startsWith('RRULE:')) {
          currentEvent.rrule = line;
        }
      }
    }
    
    console.log('Total events in calendar:', febEvents.length);
    console.log('\nEvents containing dates around Feb 26:');
    febEvents.forEach((event, idx) => {
      if (event.dtstart.includes('202602') || event.rrule) {
        console.log(`\n[Event ${idx}]`);
        console.log('  SUMMARY:', event.summary);
        console.log('  DTSTART:', event.dtstart);
        if (event.dtend) console.log('  DTEND:', event.dtend);
        if (event.rrule) console.log('  RRULE:', event.rrule);
      }
    });
    
    // Look for specific patterns
    console.log('\n--- Raw ICS content for Feb 2026 events ---');
    let printNext = false;
    for (const line of lines) {
      if (line.includes('202602')) {
        printNext = true;
      }
      if (printNext && (line.includes('BEGIN:VEVENT') || line.includes('SUMMARY:') || line.includes('DTSTART') || line.includes('DTEND') || line.includes('RRULE:') || line.includes('END:VEVENT'))) {
        console.log(line);
      }
      if (line.includes('END:VEVENT')) {
        printNext = false;
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchAndInspect();
