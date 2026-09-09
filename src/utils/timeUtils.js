// Nguva chaiyo ye Africa (CAT - Central Africa Time / Zimbabwe)
const TIMEZONE = 'Africa/Harare';

function adjustLiveMinute(rawDetail) {
  if (!rawDetail) return "LIVE 🔴";
  const str = String(rawDetail).trim();
  const lower = str.toLowerCase();

  if (str.toUpperCase() === "HT" || lower.includes("half time") || lower.includes("halftime")) return "Half Time ⏸️";
  if (str.toUpperCase() === "FT" || lower.includes("full time") || lower.includes("fulltime")) return "Full Time 🏁";

  const added = str.match(/(\d+)\s*\+\s*(\d+)/);
  if (added) return `${added[1]}+${added[2]}'`;

  const minute = str.match(/^(\d+)/);
  if (minute) return `${minute[1]}'`;

  return str.includes("'") ? str : `${str}'`;
}

// Kick-off time in CAT (e.g. 21:00 CAT)
function formatMatchTimes(dateStr) {
  try {
    const d = new Date(dateStr);
    const timeStr = d.toLocaleTimeString('en-GB', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${timeStr} CAT`;
  } catch {
    return dateStr;
  }
}

// Date yemu Africa (kuitira kuti pakarepo kana nguva yadarika pakati pehusiku mu Africa riite update)
function getYYYYMMDD(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d).replace(/-/g, '');
}

function getFormattedDateString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('en-GB', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) + ' (CAT)';
}

function parseDateFromText(text) {
  const clean = text.trim().replace(/-/g, '');
  if (/^\d{8}$/.test(clean)) {
    return { dateStr: clean, label: text.trim() };
  }
  return { dateStr: getYYYYMMDD(0), label: getFormattedDateString(0) };
}

module.exports = {
  adjustLiveMinute,
  formatMatchTimes,
  getYYYYMMDD,
  getFormattedDateString,
  parseDateFromText
};
