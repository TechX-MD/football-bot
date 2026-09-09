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

function formatMatchTimes(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function getYYYYMMDD(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function getFormattedDateString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toDateString();
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
