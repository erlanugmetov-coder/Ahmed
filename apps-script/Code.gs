/**
 * Связка сайта «Закуп и смены» с Google Таблицей.
 * Вставьте этот код в Расширения → Apps Script и опубликуйте как веб-приложение.
 * Листы создаются сами при первом запросе (или запустите функцию setup вручную).
 */

const TZ = "Asia/Almaty";
const MAX_SHIFT_HOURS = 20; // если «Ушёл» позже — считаем, что уход забыли отметить

function setup() {
  const ss = SpreadsheetApp.getActive();
  sheet_(ss, "Отметки", ["Дата и время", "Отметка", "Имя", "Точка"]);
  sheet_(ss, "Списки", ["Дата и время", "Тип", "Точка", "Текст"]);
  sheet_(ss, "Ставки", ["Имя", "Ставка ₸/час"]);
  const s = sheet_(ss, "Настройки", ["Параметр", "Значение"]);
  if (s.getLastRow() < 2) s.appendRow(["PIN", "1234"]);
}

function sheet_(ss, name, header) {
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(header);
    s.setFrozenRows(1);
    s.getRange(1, 1, 1, header.length).setFontWeight("bold");
  }
  return s;
}

function doGet() {
  return json_({ ok: true, msg: "Связка работает" });
}

function doPost(e) {
  try {
    setup();
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const ss = SpreadsheetApp.getActive();
    const now = new Date();

    if (d.action === "mark") {
      const name = cleanName_(d.name), point = String(d.point || "").trim();
      if (!name || !point || (d.type !== "in" && d.type !== "out")) return json_({ ok: false, err: "Не хватает данных" });
      ss.getSheetByName("Отметки").appendRow([now, d.type === "in" ? "Пришёл" : "Ушёл", name, point]);
      return json_({ ok: true });
    }

    if (d.action === "list") {
      ss.getSheetByName("Списки").appendRow([now, d.mode === "left" ? "Остатки" : "Закуп", String(d.point || ""), String(d.text || "").slice(0, 5000)]);
      return json_({ ok: true });
    }

    // дальше — только с PIN
    if (String(d.pin || "") !== pin_(ss)) return json_({ ok: false, err: "Неверный PIN" });

    if (d.action === "setRate") {
      const name = cleanName_(d.name), rate = Number(d.rate) || 0;
      const s = ss.getSheetByName("Ставки");
      const vals = s.getDataRange().getValues();
      let row = vals.findIndex((r, i) => i > 0 && key_(r[0]) === key_(name));
      if (row > 0) s.getRange(row + 1, 2).setValue(rate);
      else s.appendRow([name, rate]);
      return json_({ ok: true });
    }

    if (d.action === "tabel") return json_(tabel_(ss, String(d.month || "")));

    return json_({ ok: false, err: "Неизвестное действие" });
  } catch (err) {
    return json_({ ok: false, err: String(err) });
  }
}

function tabel_(ss, month) {
  const marks = ss.getSheetByName("Отметки").getDataRange().getValues().slice(1)
    .filter(r => r[0] instanceof Date && r[2])
    .map(r => ({ t: r[0], type: r[1] === "Пришёл" ? "in" : "out", name: cleanName_(r[2]), point: String(r[3]) }))
    .sort((a, b) => a.t - b.t);

  const rates = {};
  ss.getSheetByName("Ставки").getDataRange().getValues().slice(1).forEach(r => { if (r[0]) rates[key_(r[0])] = Number(r[1]) || 0; });

  const fmtD = t => Utilities.formatDate(t, TZ, "dd.MM.yyyy");
  const fmtT = t => Utilities.formatDate(t, TZ, "HH:mm");
  const mon = t => Utilities.formatDate(t, TZ, "yyyy-MM");

  const groups = {};
  marks.forEach(m => { const k = key_(m.name) + "|" + m.point; (groups[k] = groups[k] || []).push(m); });

  const shifts = [], problems = [];
  Object.keys(groups).forEach(k => {
    let open = null;
    groups[k].forEach(m => {
      if (m.type === "in") {
        if (open) problems.push({ name: open.name, point: open.point, date: fmtD(open.t), time: fmtT(open.t), issue: "Нет отметки «Ушёл»", m: mon(open.t) });
        open = m;
      } else {
        const h = open ? (m.t - open.t) / 3600000 : -1;
        if (open && h > 0 && h <= MAX_SHIFT_HOURS) {
          shifts.push({ name: open.name, point: open.point, date: fmtD(open.t), from: fmtT(open.t), to: fmtT(m.t), hours: h, m: mon(open.t) });
        } else {
          if (open) problems.push({ name: open.name, point: open.point, date: fmtD(open.t), time: fmtT(open.t), issue: "Нет отметки «Ушёл»", m: mon(open.t) });
          problems.push({ name: m.name, point: m.point, date: fmtD(m.t), time: fmtT(m.t), issue: "Нет отметки «Пришёл»", m: mon(m.t) });
        }
        open = null;
      }
    });
    if (open) problems.push({ name: open.name, point: open.point, date: fmtD(open.t), time: fmtT(open.t), issue: "Ещё на смене или нет «Ушёл»", m: mon(open.t) });
  });

  const months = Array.from(new Set(shifts.map(s => s.m).concat(problems.map(p => p.m)))).sort().reverse();
  if (!month) month = months[0] || mon(new Date());

  const rowsMap = {};
  shifts.filter(s => s.m === month).forEach(s => {
    const k = key_(s.name) + "|" + s.point;
    const r = rowsMap[k] = rowsMap[k] || { name: s.name, point: s.point, shifts: 0, hours: 0 };
    r.shifts++; r.hours += s.hours;
  });
  const rows = Object.keys(rowsMap).map(k => {
    const r = rowsMap[k];
    r.hours = Math.round(r.hours * 100) / 100;
    r.rate = rates[key_(r.name)] || 0;
    r.sum = Math.round(r.hours * r.rate);
    return r;
  }).sort((a, b) => a.point.localeCompare(b.point) || a.name.localeCompare(b.name));

  return {
    ok: true, month, months,
    rows,
    shifts: shifts.filter(s => s.m === month).map(s => ({ name: s.name, point: s.point, date: s.date, from: s.from, to: s.to, hours: Math.round(s.hours * 100) / 100 })),
    problems: problems.filter(p => p.m === month)
  };
}

function pin_(ss) {
  const vals = ss.getSheetByName("Настройки").getDataRange().getValues();
  const r = vals.find(v => String(v[0]).trim().toUpperCase() === "PIN");
  return r ? String(r[1]).trim() : "1234";
}

function cleanName_(s) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
function key_(s) { return cleanName_(s).toLowerCase(); }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
