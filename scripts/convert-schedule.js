const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function excelSerialToDate(serial) {
    if (typeof serial !== 'number') return null;
    const parsed = xlsx.SSF.parse_date_code(serial);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
}

function formatDateKey(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ============================================================
// T4.xlsx → schedule.json
// Cấu trúc: Row 0 = header [null, null, null, "Ngày", serial1, serial2, ...]
//            Row 1+ = data  [STT, name, jobTitle, roleDesc, shift1, shift2, ...]
// SheetName = "2026-04" → dùng để lấy year/month cho LichCo
// ============================================================
const t4Path = path.join(__dirname, '..', 'src', 'T4.xlsx');
const wbT4 = xlsx.readFile(t4Path);
const sheetNameT4 = wbT4.SheetNames[0]; // e.g. "2026-04"
const sheetT4 = wbT4.Sheets[sheetNameT4];
const rowsT4 = xlsx.utils.sheet_to_json(sheetT4, { header: 1 });

const T4_NAME_COL = 1;
const T4_DATE_START = 4; // first date serial in header

// Lấy year/month từ tên sheet T4 (format: "YYYY-MM")
const [sheetYear, sheetMonth] = sheetNameT4.split('-').map(Number);

const header = rowsT4[0];
const scheduleData = {};

for (let rowIndex = 1; rowIndex < rowsT4.length; rowIndex++) {
    const row = rowsT4[rowIndex];
    const name = row[T4_NAME_COL] ? String(row[T4_NAME_COL]).trim() : null;
    if (!name) continue;

    for (let col = T4_DATE_START; col < header.length; col++) {
        const cellDate = header[col];
        const shiftRaw = row[col];
        if (shiftRaw === null || shiftRaw === undefined || String(shiftRaw).trim() === '') continue;

        const shift = String(shiftRaw).trim();
        const dt = excelSerialToDate(cellDate);
        if (!dt) {
            console.warn(`[T4] Không đọc được ngày từ cột ${col}, giá trị: ${cellDate}`);
            continue;
        }

        const dateKey = formatDateKey(dt);
        if (!scheduleData[dateKey]) scheduleData[dateKey] = [];
        scheduleData[dateKey].push({ name, phone: '', code: shift.toUpperCase() });
    }
}

const outT4 = path.join(__dirname, '..', 'src', 'data', 'schedule.json');
fs.mkdirSync(path.dirname(outT4), { recursive: true });
fs.writeFileSync(outT4, JSON.stringify(scheduleData, null, 2), 'utf8');
const t4Entries = Object.values(scheduleData).reduce((s, a) => s + a.length, 0);
console.log(`✅ schedule.json: ${Object.keys(scheduleData).length} ngày, ${t4Entries} entries → ${outT4}`);

// ============================================================
// LichCo.xlsx → Thang4Co.json
// Cấu trúc: Row 0 = header [null, null, "Ngày", 1, 2, 3, ..., 30]
//            Row 1+ = data  [name, jobTitle, roleDesc, shift1, shift2, ...]
// Ngày = số thứ tự 1-30, ghép với year/month từ T4
// ============================================================
const lichCoPath = path.join(__dirname, '..', 'src', 'LichCo.xlsx');
if (!fs.existsSync(lichCoPath)) {
    console.warn('⚠️  LichCo.xlsx không tồn tại, bỏ qua Thang4Co.json');
    process.exit(0);
}

const wbCo = xlsx.readFile(lichCoPath);
const sheetCo = wbCo.Sheets[wbCo.SheetNames[0]];
const rowsCo = xlsx.utils.sheet_to_json(sheetCo, { header: 1 });

const CO_NAME_COL = 0;
const CO_DATE_START = 3; // index 3 = day 1
const headerCo = rowsCo[0];

const coData = {};

for (let rowIndex = 1; rowIndex < rowsCo.length; rowIndex++) {
    const row = rowsCo[rowIndex];
    const name = row[CO_NAME_COL] ? String(row[CO_NAME_COL]).trim() : null;
    if (!name) continue;

    for (let col = CO_DATE_START; col < headerCo.length; col++) {
        const dayNum = headerCo[col];
        const shiftRaw = row[col];
        if (shiftRaw === null || shiftRaw === undefined || String(shiftRaw).trim() === '') continue;
        if (typeof dayNum !== 'number' || dayNum < 1 || dayNum > 31) continue;

        const shift = String(shiftRaw).trim();
        const dt = new Date(sheetYear, sheetMonth - 1, dayNum);
        if (isNaN(dt)) {
            console.warn(`[LichCo] Ngày không hợp lệ: ${sheetYear}-${sheetMonth}-${dayNum}`);
            continue;
        }

        const dateKey = formatDateKey(dt);
        if (!coData[dateKey]) coData[dateKey] = [];
        coData[dateKey].push({ name, phone: '', code: shift.toUpperCase() });
    }
}

const outCo = path.join(__dirname, '..', 'src', 'data', 'Thang4Co.json');
fs.writeFileSync(outCo, JSON.stringify(coData, null, 2), 'utf8');
const coEntries = Object.values(coData).reduce((s, a) => s + a.length, 0);
console.log(`✅ Thang4Co.json: ${Object.keys(coData).length} ngày, ${coEntries} entries → ${outCo}`);


function excelSerialToDate(serial) {
    if (typeof serial !== 'number') return null;
    // xlsx.SSF.parse_date_code handles 1900 leap-year bug automatically
    const parsed = xlsx.SSF.parse_date_code(serial);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
}

function formatDateKey(date) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ============================================================