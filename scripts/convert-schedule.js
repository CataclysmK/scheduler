const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

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

const workbook = xlsx.readFile(path.join(__dirname, '..', 'src', 'T4.xlsx'));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

if (!rows || rows.length < 3) {
    throw new Error('Không tìm thấy dữ liệu sheet hợp lệ trong T4.xlsx');
}

const header = rows[0];

// Xác định cột đầu của dữ liệu ngày (thường là cột 6/7 trong file mẫu của bạn, index 6)
const dateStartIndex = 6;

const scheduleData = {};

for (let rowIndex = 2; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const name = row[1] ? String(row[1]).trim() : null;
    if (!name) continue;

    // Get phone number from column D (index 3)
    const phone = row[3] ? String(row[3]).trim() : null;

    for (let col = dateStartIndex; col < header.length; col++) {
        const cellDate = header[col];
        const shiftRaw = row[col];

        if (shiftRaw === null || shiftRaw === undefined || String(shiftRaw).trim() === '') continue;

        const shift = String(shiftRaw).trim();
        const dt = excelSerialToDate(cellDate);

        if (!dt) {
            console.warn('Không đọc được ngày từ cột', col, 'giá trị', cellDate);
            continue;
        }

        const dateKey = formatDateKey(dt);
        if (!scheduleData[dateKey]) scheduleData[dateKey] = [];

        scheduleData[dateKey].push({
            name,
            phone,
            code: shift.toUpperCase(),
        });
    }
}

const outPath = path.join(__dirname, '..', 'src', 'data', 'schedule.json');
if (!fs.existsSync(path.dirname(outPath))) fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(scheduleData, null, 2), 'utf8');
console.log('Written schedule.json with', Object.keys(scheduleData).length, 'days and total entries', Object.values(scheduleData).reduce((prv, arr) => prv + arr.length, 0), 'to', outPath);