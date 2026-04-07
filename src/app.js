const SHIFT_DEFINITIONS = {
    O: { label: 'O', description: 'Trực qua điện thoại ngoài giờ hành chính + on-site khi có sự cố', dayWindow: [['06:00','06:00']] },
    X: { label: 'X', description: 'Giờ hành chính, điều động theo chuyên môn khi có sự cố', dayWindow: [['08:00','17:00']] },
    WO: { label: 'WO', description: 'Giờ hành chính + on-call đêm 18:00-06:00', dayWindow: [['08:00','17:00'], ['18:00','06:00']] },
    D: { label: 'D', description: 'Ca ngày 06:00-18:00', dayWindow:[['06:00','18:00']] },
    N: { label: 'N', description: 'Ca đêm 18:00-06:00', dayWindow:[['18:00','06:00']] },
    V: { label: 'V', description: 'Nghỉ phép', dayWindow: [] },
};

const ROLE_ORDER = [
    'Trưởng ca',
    'Trưởng kíp (Kiêm vận hành Trạm 500kV)',
    'Trưởng kíp (Kiêm vận hành Trạm 220kV)',
    'Vận hành MTĐK HRSG &WSC',
    'Vận hành MTĐK GT/ST',
    'GM GT/ST',
    'GM HRSG &WSC',
    'Ngoài Gian Máy BOP',
];

const ROLE_COLORS = {
    'Trưởng ca': { bg: 'bg-red-100', border: 'border-red-600', text: 'text-red-900', badge: 'bg-red-300 text-red-950', leader: true },
    'Trưởng kíp (Kiêm vận hành Trạm 500kV)': { bg: 'bg-purple-100', border: 'border-purple-600', text: 'text-purple-900', badge: 'bg-purple-300 text-purple-950', leader: true },
    'Trưởng kíp (Kiêm vận hành Trạm 220kV)': { bg: 'bg-indigo-100', border: 'border-indigo-600', text: 'text-indigo-900', badge: 'bg-indigo-300 text-indigo-950', leader: true },
    'Vận hành MTĐK HRSG &WSC': { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800', badge: 'bg-blue-200 text-blue-900' },
    'Vận hành MTĐK GT/ST': { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-800', badge: 'bg-green-200 text-green-900' },
    'GM GT/ST': { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900', badge: 'bg-orange-300 text-orange-950' },
    'GM HRSG &WSC': { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-900', badge: 'bg-amber-300 text-amber-950' },
    'Ngoài Gian Máy BOP': { bg: 'bg-pink-50', border: 'border-pink-400', text: 'text-pink-800', badge: 'bg-pink-200 text-pink-900' },
};

function getColorForRole(cuongVi) {
    if (!cuongVi) return { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-800', badge: 'bg-gray-200 text-gray-900' };
    for (const [role, colors] of Object.entries(ROLE_COLORS)) {
        if (cuongVi.includes(role)) {
            return colors;
        }
    }
    return { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-800', badge: 'bg-gray-200 text-gray-900' };
}

function getRoleIndex(cuongVi) {
    if (!cuongVi) return 999;
    const index = ROLE_ORDER.findIndex(role => cuongVi.includes(role));
    return index === -1 ? 999 : index;
}

function sortStaffByRole(staffArray) {
    return [...staffArray].sort((a, b) => {
        const indexA = getRoleIndex(a.cuongVi);
        const indexB = getRoleIndex(b.cuongVi);
        return indexA - indexB;
    });
}

let phoneBook = new Map();

function parseScheduleEntry(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        const code = value.trim().toUpperCase();
        if (code in SHIFT_DEFINITIONS) return { code };
        return { name: value.trim() };
    }
    if (typeof value === 'object') {
        if ('code' in value && 'name' in value) return value;
        if ('code' in value) return { code: String(value.code).trim().toUpperCase() };
        if ('name' in value) return { name: String(value.name).trim() };
    }
    return null;
}

function inTimeWindow(now, start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin;
}

function getCurrentOnDuty(schedule, dateKey) {
    const entries = (schedule && schedule[dateKey]) || [];
    if (!Array.isArray(entries)) return [];

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const result = [];

    entries.forEach((entry) => {
        const parsed = parseScheduleEntry(entry);
        if (!parsed || parsed.code === 'X') return; // bỏ ca giờ hành chính X

        if (parsed.code) {
            const def = SHIFT_DEFINITIONS[parsed.code];
            if (!def) return;
            const isOnDuty = def.dayWindow.some(([s, e]) => {
                const [sh, sm] = s.split(':').map(Number);
                const [eh, em] = e.split(':').map(Number);
                const startMin = sh * 60 + sm;
                const endMin = eh * 60 + em;
                if (startMin === endMin) {
                    // Ca 24h bắt đầu từ startMin (vd: O: 06:00-06:00): active nếu đã qua giờ bắt đầu.
                    // Phần sáng sớm (0:00 đến startMin) thuộc lịch hôm qua, xử lý bởi getOvernightContinuationOnDuty.
                    return nowMin >= startMin;
                }
                if (startMin > endMin) {
                    // Ca qua đêm (vd: N: 18:00-06:00): chỉ tính active nếu đã qua giờ bắt đầu hôm nay.
                    // Phần 0:00-endMin thuộc lịch hôm qua, xử lý bởi getOvernightContinuationOnDuty.
                    return nowMin >= startMin;
                }
                return nowMin >= startMin && nowMin < endMin;
            });
            if (isOnDuty) {
                result.push({ code: parsed.code, role: def.description, name: parsed.name, phone: parsed.phone });
            }
        } else if (parsed.name) {
            result.push({ code: '??', role: 'Không xác định ca', name: parsed.name, phone: parsed.phone });
        }
    });

    return result;
}

// Lấy nhân sự ca qua đêm hôm qua đang tiếp tục trực trong khoảng 0:00-kết thúc ca
function getOvernightContinuationOnDuty(schedule, yesterdayKey) {
    const entries = (schedule && schedule[yesterdayKey]) || [];
    if (!Array.isArray(entries)) return [];

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const result = [];

    entries.forEach((entry) => {
        const parsed = parseScheduleEntry(entry);
        if (!parsed || parsed.code === 'X') return;

        if (parsed.code) {
            const def = SHIFT_DEFINITIONS[parsed.code];
            if (!def) return;
            const isOnDuty = def.dayWindow.some(([s, e]) => {
                const [sh, sm] = s.split(':').map(Number);
                const [eh, em] = e.split(':').map(Number);
                const startMin = sh * 60 + sm;
                const endMin = eh * 60 + em;
                if (startMin === endMin) {
                    // Ca 24h (vd: O: 06:00-06:00): phần sáng sớm (0:00 đến startMin) vẫn là lịch hôm qua
                    return nowMin < startMin;
                }
                // Ca qua đêm thông thường (vd: N: 18:00-06:00)
                return startMin > endMin && nowMin < endMin;
            });
            if (isOnDuty) {
                result.push({ code: parsed.code, role: def.description, name: parsed.name, phone: parsed.phone });
            }
        }
    });

    return result;
}

function dateToKey(date) {
    const d = new Date(date);
    if (isNaN(d)) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateDDMMYYYY(dateKeyOrDate) {
    let dateStr = dateKeyOrDate;
    if (dateKeyOrDate instanceof Date) {
        dateStr = dateToKey(dateKeyOrDate);
    }
    if (!dateStr || typeof dateStr !== 'string') return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function formatPhoneNumber(phone) {
    if (!phone) return phone;
    const phoneStr = String(phone).trim();
    if (phoneStr && !phoneStr.startsWith('0')) {
        return '0' + phoneStr;
    }
    return phoneStr;
}

function formatDateWithDayOfWeek(dateKeyOrDate) {
    let dateObj = dateKeyOrDate;
    if (typeof dateKeyOrDate === 'string') {
        const parts = dateKeyOrDate.split('-');
        if (parts.length === 3) {
            dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            return dateKeyOrDate;
        }
    }
    if (!(dateObj instanceof Date) || isNaN(dateObj)) return dateKeyOrDate;
    
    const dayOfWeek = dateObj.getDay();
    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = dayNames[dayOfWeek];
    const dateStr = dateToKey(dateObj);
    const dateDisplay = formatDateDDMMYYYY(dateStr);
    return `${dayName} - ${dateDisplay}`;
}

function sortByShiftPriority(items) {
    const shiftOrder = { WO: 0, O: 1, D: 2, N: 3 };
    return items.sort((a, b) => {
        const aCode = a.code || '??';
        const bCode = b.code || '??';
        const aPriority = shiftOrder[aCode] ?? 999;
        const bPriority = shiftOrder[bCode] ?? 999;
        return aPriority - bPriority;
    });
}

function getAssignmentsForDate(schedule, dateKey, excludeX = false) {
    const entries = (schedule && schedule[dateKey]) || [];
    return Array.isArray(entries)
        ? entries
              .map((entry) => parseScheduleEntry(entry))
              .filter((item) => item && (!excludeX || item.code !== 'X') && item.code !== 'V')
        : [];
}

function renderCurrentShift(schedule, targetId = 'current-shift-info') {
    const now = new Date();
    const todayKey = dateToKey(now);
    const todayDisplay = formatDateWithDayOfWeek(todayKey);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let currentList = getCurrentOnDuty(schedule, todayKey);

    // Từ 0:00 đến 5:59: ca đêm (18:00-06:00) thuộc lịch hôm qua vẫn đang tiếp tục trực
    if (nowMin < 6 * 60) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = dateToKey(yesterday);
        const overnightList = getOvernightContinuationOnDuty(schedule, yesterdayKey);
        currentList = [...overnightList, ...currentList];
    }

    currentList = sortByShiftPriority(currentList);
    const wrap = document.getElementById(targetId);

    // Cập nhật ngày chung (chỉ 1 lần cho cả section)
    const dateEl = document.getElementById('current-shift-date');
    if (dateEl) dateEl.innerHTML = `Ngày hiện tại: <strong class="text-lg text-gray-800">${todayDisplay}</strong>`;

    if (currentList.length === 0) {
        wrap.innerHTML = `<p class="text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200">⚠️ Hiện tại không ai trực (có thể nghỉ, mã không rõ hoặc ngoài ca).</p>`;
        return;
    }

    wrap.innerHTML = `<ul class="space-y-2">` +
        currentList.map((item) => {
            return `<li class="px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="font-bold text-red-900 text-lg">${item.name || '(không tên)'}</span><br>
                        <span class="text-sm text-red-700 font-medium">${item.code} - ${item.role}</span>
                    </div>
                    <div class="flex gap-2 mt-1">
                        ${renderPhoneButtons(item.name, item.phone)}
                    </div>
                </div>
            </li>`;
        }).join('') +
        '</ul>';
}

function renderOffToday(schedule, scheduleCoNhiet) {
    const today = new Date();
    const dow = today.getDay(); // 0=Sun, 6=Sat
    const todayKey = dateToKey(today);
    const todayDisplay = formatDateWithDayOfWeek(todayKey);

    const dateEl = document.getElementById('off-today-date');
    if (dateEl) dateEl.innerHTML = `Ngày hiện tại: <strong class="text-lg text-gray-800">${todayDisplay}</strong>`;

    const weekdayDiv = document.getElementById('off-today-weekday');
    const weekendDiv = document.getElementById('off-today-weekend');

    if (dow === 0 || dow === 6) {
        weekdayDiv.classList.add('hidden');
        weekendDiv.classList.remove('hidden');
        return;
    }
    weekendDiv.classList.add('hidden');
    weekdayDiv.classList.remove('hidden');

    const renderOffList = (sched, targetId) => {
        const entries = (sched && sched[todayKey]) || [];
        const offPeople = Array.isArray(entries)
            ? entries.map(e => parseScheduleEntry(e)).filter(e => {
                if (!e) return false;
                const code = e.code;
                // V = Nghỉ phép, N = Ca đêm (nghỉ giờ hành chính)
                return code === 'V' || code === 'N';
              })
            : [];
        const el = document.getElementById(targetId);
        if (!el) return;
        if (offPeople.length === 0) {
            el.innerHTML = '<p class="text-gray-500">Không có ai nghỉ hôm nay.</p>';
            return;
        }
        el.innerHTML = '<ul class="space-y-1">' +
            offPeople.map(item => {
                const label = item.code === 'N'
                    ? '<span class="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Ca đêm</span>'
                    : '<span class="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Nghỉ theo lịch</span>';
                return `<li class="px-3 py-2 bg-gray-50 border-l-4 border-gray-300 rounded">
                    <div class="flex justify-between items-start flex-wrap gap-y-1">
                        <span class="font-medium text-gray-700">${item.name || '(không tên)'}${label}</span>
                        <div class="flex gap-2">${renderPhoneButtons(item.name, item.phone)}</div>
                    </div>
                </li>`;
            }).join('') + '</ul>';
    };

    renderOffList(schedule, 'off-today-dien-ci');
    renderOffList(scheduleCoNhiet, 'off-today-co-nhiet');
}

function renderDaySchedule(schedule, selectedDate, targetId = 'day-schedule') {
    const key = dateToKey(selectedDate);
    const keyDisplay = formatDateWithDayOfWeek(key);
    let assignments = getAssignmentsForDate(schedule, key, true); // loại bỏ X
    assignments = sortByShiftPriority(assignments);
    const el = document.getElementById(targetId);

    if (assignments.length === 0) {
        el.innerHTML = `<p class="text-gray-600">Không có ai trực (trừ ca X).</p>`;
        return;
    }

    el.innerHTML = `<ul class="space-y-2">` +
        assignments.map((item) => {
            return `<li class="px-3 py-2 bg-white border-l-4 border-green-400 rounded">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="font-semibold text-gray-800">${item.name || '(Không tên)'}</span> - <span class="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">${item.code || '(Unknown code)'}</span><br>
                        <span class="text-gray-600 text-sm">${item.code ? SHIFT_DEFINITIONS[item.code]?.description : ''}</span>
                    </div>
                    <div class="flex gap-2 mt-1">
                        ${renderPhoneButtons(item.name, item.phone)}
                    </div>
                </div>
            </li>`;
        }).join('') +
        '</ul>';
}

function getUniqueStaff(schedule) {
    const names = new Set();
    Object.values(schedule).forEach((entries) => {
        if (!Array.isArray(entries)) return;
        entries.forEach((entry) => {
            const parsed = parseScheduleEntry(entry);
            if (parsed && parsed.name) names.add(parsed.name);
            else if (parsed && parsed.code && parsed.name) names.add(parsed.name);
        });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'vi'));
}

function setupPersonSearch(schedule) {
    const searchInput = document.getElementById('person-search');
    const dropdown = document.getElementById('person-dropdown');
    const personSelect = document.getElementById('person-select');
    const selectedPersonDiv = document.getElementById('selected-person');
    const datePicker = document.getElementById('date-picker');
    const allStaff = getUniqueStaff(schedule);

    if (!searchInput || !dropdown || !personSelect || !selectedPersonDiv) {
        console.error('Missing search elements in DOM');
        return;
    }

    function showDropdown(matches) {
        if (!matches || matches.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        dropdown.innerHTML = matches
            .map((name) => `<div class="dropdown-item" data-name="${name}">${name}</div>`)
            .join('');
        dropdown.style.display = 'block';

        // Add event listeners to each item
        document.querySelectorAll('.dropdown-item').forEach((item) => {
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#dbeafe';
            });
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'transparent';
            });
            item.addEventListener('click', (e) => {
                const name = e.target.getAttribute('data-name');
                if (!name) return;
                
                searchInput.value = name;
                personSelect.value = name;
                selectedPersonDiv.textContent = `✓ Đã chọn: ${name}`;
                selectedPersonDiv.classList.remove('hidden');
                dropdown.style.display = 'none';
                
                // Save to localStorage
                localStorage.setItem('selectedPerson', name);
                
                // Auto-trigger both week and month view
                renderWeekSchedule(schedule, datePicker.value, name);
                renderMonthSchedule(schedule, datePicker.value, name);
            });
        });
    }

    // Input event - filter as user types
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            dropdown.style.display = 'none';
            return;
        }
        const matches = allStaff.filter((name) => name.toLowerCase().includes(query));
        showDropdown(matches);
    });

    // Focus event - show all or filtered list
    searchInput.addEventListener('focus', () => {
        const query = searchInput.value.toLowerCase().trim();
        if (query) {
            const matches = allStaff.filter((name) => name.toLowerCase().includes(query));
            showDropdown(matches);
        } else {
            showDropdown(allStaff);
        }
    });

    // Click outside - close dropdown
    document.addEventListener('click', (e) => {
        const isClickInsideSearch = searchInput.contains(e.target);
        const isClickInsideDropdown = dropdown.contains(e.target);
        if (!isClickInsideSearch && !isClickInsideDropdown) {
            dropdown.style.display = 'none';
        }
    });
}

function getPersonCode(schedule, dateKey, person) {
    const assignments = (schedule && schedule[dateKey]) || [];
    if (!Array.isArray(assignments)) return null;
    const item = assignments.find((entry) => {
        const parsed = parseScheduleEntry(entry);
        return parsed && parsed.name === person;
    });
    if (!item) return null;
    const parsed = parseScheduleEntry(item);
    if (parsed && parsed.code) return parsed.code === 'V' ? null : parsed.code;
    return null;
}

function renderWeekSchedule(schedule, selectedDate, person) {
    if (!person) {
        document.getElementById('week-schedule').innerHTML = '<p class="text-gray-600">Vui lòng chọn nhân viên để xem lịch tuần.</p>';
        return;
    }

    const base = new Date(selectedDate);
    const dow = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((dow + 6) % 7));

    const mondayDisplay = formatDateDDMMYYYY(dateToKey(monday));
    const sundayDisplay = formatDateDDMMYYYY(dateToKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)));
    let html = `<h3 class="text-lg font-semibold text-gray-800 mb-3">Tuần ${mondayDisplay} - ${sundayDisplay} <span class="text-blue-600">${person}</span></h3>`;
    html += '<div class="overflow-x-auto"><table class="w-full border-collapse"><thead><tr class="bg-blue-50"><th class="border border-gray-300 px-3 py-2 font-semibold text-gray-700">Thứ</th><th class="border border-gray-300 px-3 py-2 font-semibold text-gray-700">Ngày</th><th class="border border-gray-300 px-3 py-2 font-semibold text-gray-700">Ca Trực</th></tr></thead><tbody>';

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = dateToKey(d);
        const keyDisplay = formatDateDDMMYYYY(key);
        const code = getPersonCode(schedule, key, person);
        const label = code ? `<span class="font-semibold">${code}</span><br><span class="text-xs text-gray-600">${SHIFT_DEFINITIONS[code]?.description || 'Không xác định'}</span>` : '<span class="text-gray-400">Nghỉ</span>';
        const cssClass = code ? 'cell-' + code.toLowerCase() : 'cell-off';
        html += `<tr class="${cssClass}"><td class="border border-gray-300 px-3 py-2 text-center font-medium">${['T2','T3','T4','T5','T6','T7','CN'][i]}</td><td class="border border-gray-300 px-3 py-2 text-center text-sm">${keyDisplay}</td><td class="border border-gray-300 px-3 py-2 text-center">${label}</td></tr>`;
    }

    html += '</tbody></table></div>';
    document.getElementById('week-schedule').innerHTML = html;
}

function renderMonthSchedule(schedule, selectedDate, person) {
    if (!person) {
        document.getElementById('month-schedule').innerHTML = '<p class="text-gray-600">Vui lòng chọn nhân viên để xem lịch tháng.</p>';
        return;
    }

    const ref = new Date(selectedDate);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `<h3 class="text-lg font-semibold text-gray-800 mb-3">Tháng ${month + 1}/${year} <span class="text-purple-600">${person}</span></h3>`;
    html += '<div class="overflow-x-auto"><table class="w-full border-collapse"><thead><tr class="bg-purple-50"><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T2</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T3</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T4</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T5</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T6</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T7</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">CN</th></tr></thead><tbody><tr>';

    // start empty until first Monday (startDow: 0=Sunday->6 blanks, 1=Monday->0 blanks, etc.)
    const emptyStart = startDow === 0 ? 6 : startDow - 1;
    for (let i = 0; i < emptyStart; i++) html += '<td class="border border-gray-300 h-20 bg-gray-100"></td>';

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const key = dateToKey(date);
        const code = getPersonCode(schedule, key, person);
        const label = code ? `<span class="font-semibold text-sm">${code}</span>` : '';
        const cssClass = code ? 'cell-' + code.toLowerCase() : 'cell-off';

        html += `<td class="border border-gray-300 h-20 p-2 align-top ${cssClass}"><span class="font-bold text-lg text-gray-800 block">${d}</span><span class="text-center block text-xs">${label}</span></td>`;

        if (date.getDay() === 0 && d < daysInMonth) html += '</tr><tr>';
    }

    // fill trailing empty cells (if last day is not Sunday)
    const lastDate = new Date(year, month, daysInMonth).getDay();
    const emptyEnd = lastDate === 0 ? 0 : 7 - lastDate;
    for (let j = 0; j < emptyEnd; j++) html += '<td class="border border-gray-300 h-20 bg-gray-100"></td>';

    html += '</tr></tbody></table></div>';

    document.getElementById('month-schedule').innerHTML = html;
}

function mergeSchedulesForTSC(s1, s2) {
    const merged = {};
    const allKeys = new Set([...Object.keys(s1 || {}), ...Object.keys(s2 || {})]);
    allKeys.forEach(key => {
        const a = (s1 && Array.isArray(s1[key])) ? s1[key] : [];
        const b = (s2 && Array.isArray(s2[key])) ? s2[key] : [];
        merged[key] = [...a, ...b];
    });
    return merged;
}

function setupUI(schedule, scheduleCoNhiet) {
    const datePicker = document.getElementById('date-picker');
    const personSelect = document.getElementById('person-select');
    const selectedPersonDiv = document.getElementById('selected-person');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const searchInput = document.getElementById('person-search');
    
    datePicker.value = dateToKey(new Date());

    const mergedSchedule = mergeSchedulesForTSC(schedule, scheduleCoNhiet);

    // Display selected date with day of week
    const updateDateDisplay = () => {
        if (selectedDateDisplay && datePicker.value) {
            selectedDateDisplay.textContent = formatDateWithDayOfWeek(datePicker.value);
        }
    };
    updateDateDisplay();

    setupPersonSearch(mergedSchedule);

    renderCurrentShift(schedule);
    if (scheduleCoNhiet) renderCurrentShift(scheduleCoNhiet, 'current-shift-co-nhiet-info');
    renderOffToday(schedule, scheduleCoNhiet);
    renderDaySchedule(schedule, datePicker.value);
    if (scheduleCoNhiet) renderDaySchedule(scheduleCoNhiet, datePicker.value, 'day-schedule-co-nhiet');

    // Load previously selected person from localStorage
    const savedPerson = localStorage.getItem('selectedPerson');
    if (savedPerson) {
        searchInput.value = savedPerson;
        personSelect.value = savedPerson;
        selectedPersonDiv.textContent = `✓ Đã chọn: ${savedPerson}`;
        selectedPersonDiv.classList.remove('hidden');
        // Auto-render both week and month for previously selected person
        renderWeekSchedule(mergedSchedule, datePicker.value, savedPerson);
        renderMonthSchedule(mergedSchedule, datePicker.value, savedPerson);
    }

    // Auto-render day schedule when date changes
    const updateOnDateChange = () => {
        updateDateDisplay();
        renderDaySchedule(schedule, datePicker.value);
        if (scheduleCoNhiet) renderDaySchedule(scheduleCoNhiet, datePicker.value, 'day-schedule-co-nhiet');
        const person = personSelect.value;
        if (person) {
            renderWeekSchedule(mergedSchedule, datePicker.value, person);
            renderMonthSchedule(mergedSchedule, datePicker.value, person);
        }
    };
    
    datePicker.addEventListener('change', updateOnDateChange);
    datePicker.addEventListener('input', updateOnDateChange);

    setInterval(() => {
        renderCurrentShift(schedule);
        if (scheduleCoNhiet) renderCurrentShift(scheduleCoNhiet, 'current-shift-co-nhiet-info');
        renderOffToday(schedule, scheduleCoNhiet);
    }, 60000);
}

async function loadSchedule() {
    try {
        const res = await fetch('./data/schedule.json');
        if (!res.ok) throw new Error('Lỗi tải dữ liệu');
        return await res.json();
    } catch (e) {
        console.error('Không thể load schedule:', e);
        return null;
    }
}

async function loadOperationsSchedule(dataFile) {
    try {
        const res = await fetch(`./data/${dataFile}`);
        if (!res.ok) throw new Error(`Lỗi tải dữ liệu ${dataFile}`);
        return await res.json();
    } catch (e) {
        console.error(`Không thể load ${dataFile}:`, e);
        return null;
    }
}

async function loadDanhBa() {
    try {
        const res = await fetch('./data/DanhBa.json');
        if (!res.ok) throw new Error('Lỗi tải danh bạ');
        return await res.json();
    } catch (e) {
        console.error('Không thể load DanhBa:', e);
        return null;
    }
}

function buildPhoneBook(danhBaData) {
    const map = new Map();
    if (!danhBaData || !Array.isArray(danhBaData.danhBa)) return map;
    danhBaData.danhBa.forEach(entry => {
        if (entry.hoVaTen) map.set(entry.hoVaTen.trim(), entry.soDienThoai || '');
    });
    return map;
}

function renderPhoneButtons(name, fallbackPhone) {
    let phone = '';
    if (name) {
        const fromBook = phoneBook.get(name.trim());
        phone = (fromBook !== undefined && fromBook !== '') ? fromBook : (fallbackPhone || '');
    } else {
        phone = fallbackPhone || '';
    }
    const formatted = formatPhoneNumber(phone);
    if (formatted) {
        return `<a href="tel:${formatted}" class="px-3 py-1 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition whitespace-nowrap">📞 Gọi</a>
        <a href="https://zalo.me/${formatted}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1 bg-blue-400 text-white rounded text-sm font-medium hover:bg-blue-500 transition whitespace-nowrap"><img src="https://cdn.simpleicons.org/zalo/ffffff" style="width:14px;height:14px;" alt="Zalo"> Zalo</a>`;
    }
    return `<span class="px-2 py-1 bg-gray-100 text-gray-400 rounded text-xs font-medium">📵 TBD</span>`;
}

function isShiftTimeWindow(now, startTime, endTime) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin;
}

function getCurrentShiftCode(thongTinCa) {
    const now = new Date();
    for (const [caCode, shiftInfo] of Object.entries(thongTinCa)) {
        if (isShiftTimeWindow(now, shiftInfo.gioBatDau, shiftInfo.gioKetThuc)) {
            return caCode;
        }
    }
    return null;
}

function getNextShiftCode(thongTinCa) {
    const now = new Date();
    const currentShift = getCurrentShiftCode(thongTinCa);
    const caOrder = ['ca1', 'ca2', 'ca3'];
    const currentIndex = caOrder.indexOf(currentShift);
    if (currentIndex !== -1) {
        return caOrder[(currentIndex + 1) % 3];
    }
    return 'ca1';
}

function renderOperationsCurrentShift(t4tcData, t4vhvData) {
    const todayKey = dateToKey(new Date());
    const todayDisplay = formatDateWithDayOfWeek(todayKey);
    
    // T4TC Current Shift
    const t4tcCurrentShift = getCurrentShiftCode(t4tcData.thongTinCa);
    const t4tcNextShift = getNextShiftCode(t4tcData.thongTinCa);
    const t4tcCurrentStaff = (t4tcData.lichTruc[todayKey] && t4tcData.lichTruc[todayKey][t4tcCurrentShift]) || [];
    const t4tcNextStaff = (t4tcData.lichTruc[todayKey] && t4tcData.lichTruc[todayKey][t4tcNextShift]) || [];
    
    const t4tcCurrentInfo = document.getElementById('operations-t4tc-current');
    let t4tcHtml = '';
    
    if (t4tcCurrentShift) {
        const currentShiftInfo = t4tcData.thongTinCa[t4tcCurrentShift];
        t4tcHtml += `<div class="mb-3">
            <p class="text-sm text-gray-600 mb-2">Đang trực (${currentShiftInfo.gioBatDau} - ${currentShiftInfo.gioKetThuc})</p>
            <div id="t4tc-current-list">`;
        
        if (t4tcCurrentStaff.length > 0) {
            t4tcHtml += t4tcCurrentStaff.map(staff => `
                <div class="bg-blue-50 border-l-4 border-blue-500 px-3 py-2 mb-2 rounded">
                    <p class="font-semibold text-gray-800">${staff.nhanSu}</p>
                    <p class="text-xs text-gray-600">${staff.cuongVi} - ${staff.doi}</p>
                </div>
            `).join('');
        } else {
            t4tcHtml += '<p class="text-gray-500">Không có dữ liệu</p>';
        }
        
        t4tcHtml += `</div></div>`;
    } else {
        t4tcHtml += '<p class="text-gray-500">Không xác định ca</p>';
    }
    
    if (t4tcNextShift) {
        const nextShiftInfo = t4tcData.thongTinCa[t4tcNextShift];
        t4tcHtml += `<div class="border-t pt-3">
            <p class="text-sm text-gray-600 mb-2">Ca tiếp theo (${nextShiftInfo.gioBatDau} - ${nextShiftInfo.gioKetThuc})</p>
            <div id="t4tc-next-list">`;
        
        if (t4tcNextStaff.length > 0) {
            t4tcHtml += t4tcNextStaff.map(staff => `
                <div class="bg-blue-100 border-l-4 border-blue-300 px-3 py-2 mb-2 rounded">
                    <p class="font-semibold text-gray-800">${staff.nhanSu}</p>
                    <p class="text-xs text-gray-600">${staff.cuongVi} - ${staff.doi}</p>
                </div>
            `).join('');
        } else {
            t4tcHtml += '<p class="text-gray-500">Không có dữ liệu</p>';
        }
        
        t4tcHtml += `</div></div>`;
    }
    
    t4tcCurrentInfo.innerHTML = t4tcHtml;
    
    // T4VHV Current Shift
    const t4vhvCurrentShift = getCurrentShiftCode(t4vhvData.thongTinCa);
    const t4vhvNextShift = getNextShiftCode(t4vhvData.thongTinCa);
    const t4vhvCurrentStaff = (t4vhvData.lichTruc[todayKey] && t4vhvData.lichTruc[todayKey][t4vhvCurrentShift]) || [];
    const t4vhvNextStaff = (t4vhvData.lichTruc[todayKey] && t4vhvData.lichTruc[todayKey][t4vhvNextShift]) || [];
    
    const t4vhvCurrentInfo = document.getElementById('operations-t4vhv-current');
    let t4vhvHtml = '';
    
    if (t4vhvCurrentShift) {
        const currentShiftInfo = t4vhvData.thongTinCa[t4vhvCurrentShift];
        t4vhvHtml += `<div class="mb-3">
            <p class="text-sm text-gray-600 mb-2">Đang trực (${currentShiftInfo.gioBatDau} - ${currentShiftInfo.gioKetThuc})</p>
            <div id="t4vhv-current-list">`;
        
        if (t4vhvCurrentStaff.length > 0) {
            t4vhvHtml += t4vhvCurrentStaff.map(staff => `
                <div class="bg-green-50 border-l-4 border-green-500 px-3 py-2 mb-2 rounded">
                    <p class="font-semibold text-gray-800">${staff.nhanSu}</p>
                    <p class="text-xs text-gray-600">${staff.cuongVi} - ${staff.doi}</p>
                </div>
            `).join('');
        } else {
            t4vhvHtml += '<p class="text-gray-500">Không có dữ liệu</p>';
        }
        
        t4vhvHtml += `</div></div>`;
    } else {
        t4vhvHtml += '<p class="text-gray-500">Không xác định ca</p>';
    }
    
    if (t4vhvNextShift) {
        const nextShiftInfo = t4vhvData.thongTinCa[t4vhvNextShift];
        t4vhvHtml += `<div class="border-t pt-3">
            <p class="text-sm text-gray-600 mb-2">Ca tiếp theo (${nextShiftInfo.gioBatDau} - ${nextShiftInfo.gioKetThuc})</p>
            <div id="t4vhv-next-list">`;
        
        if (t4vhvNextStaff.length > 0) {
            t4vhvHtml += t4vhvNextStaff.map(staff => `
                <div class="bg-green-100 border-l-4 border-green-300 px-3 py-2 mb-2 rounded">
                    <p class="font-semibold text-gray-800">${staff.nhanSu}</p>
                    <p class="text-xs text-gray-600">${staff.cuongVi} - ${staff.doi}</p>
                </div>
            `).join('');
        } else {
            t4vhvHtml += '<p class="text-gray-500">Không có dữ liệu</p>';
        }
        
        t4vhvHtml += `</div></div>`;
    }
    
    t4vhvCurrentInfo.innerHTML = t4vhvHtml;
}

function renderCVHCurrentShift(cvhData, targetElementId) {
    const now = new Date();
    const todayKey = dateToKey(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    
    const currentShiftCode = getCurrentShiftCode(cvhData.thongTinCa);

    // Xác định ngày cần tra lịch nhân sự:
    // Ca qua đêm (vd: 18:00-06:00) trong khoảng 0:00-kết thúc ca → nhân sự là của lịch hôm qua
    let staffDateKey = todayKey;
    if (currentShiftCode) {
        const shiftInfo = cvhData.thongTinCa[currentShiftCode];
        const [sh, sm] = shiftInfo.gioBatDau.split(':').map(Number);
        const [eh, em] = shiftInfo.gioKetThuc.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        if (startMin > endMin && nowMin < endMin) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            staffDateKey = dateToKey(yesterday);
        }
    }

    const currentStaff = (cvhData.lichTruc[staffDateKey] && cvhData.lichTruc[staffDateKey][currentShiftCode]) || [];
    
    const sortedCurrentStaff = sortStaffByRole(currentStaff);
    const targetEl = document.getElementById(targetElementId);
    let html = '';
    
    if (currentShiftCode) {
        const shiftInfo = cvhData.thongTinCa[currentShiftCode];
        
        // Tách Trưởng Ca/Trưởng kíp riêng
        const leaders = sortedCurrentStaff.filter(staff => {
            const colors = getColorForRole(staff.cuongVi);
            return colors.leader === true;
        });
        const staff = sortedCurrentStaff.filter(s => {
            const colors = getColorForRole(s.cuongVi);
            return colors.leader !== true;
        });
        
        html += `<div class="mb-4">
            <p class="text-sm font-semibold text-orange-700 mb-3">Đang trực (${shiftInfo.gioBatDau} - ${shiftInfo.gioKetThuc})</p>`;
        
        // Hiển thị Trưởng Ca/Trưởng kíp nổi bật
        if (leaders.length > 0) {
            html += `<div class="mb-4 pb-4 border-b-2 border-orange-300">`;
            html += leaders.map(person => {
                const colors = getColorForRole(person.cuongVi);
                return `
                <div class="staff-card ${colors.bg} border-l-4 ${colors.border} px-4 py-3 mb-2 rounded shadow-md">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-lg ${colors.text}">${person.nhanSu}</p>
                            <p class="text-xs ${colors.text} font-semibold">${person.cuongVi}</p>
                        </div>
                        <div class="flex gap-2 mt-1">${renderPhoneButtons(person.nhanSu, null)}</div>
                    </div>
                </div>
            `}).join('');
            html += `</div>`;
        }
        
        // Hiển thị Vận Hành Viên
        if (staff.length > 0) {
            html += staff.map(person => {
                const colors = getColorForRole(person.cuongVi);
                return `
                <div class="staff-card ${colors.bg} border-l-4 ${colors.border} px-3 py-2 mb-2 rounded">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-semibold ${colors.text}">${person.nhanSu}</p>
                            <p class="text-xs ${colors.text} opacity-75">${person.cuongVi}</p>
                        </div>
                        <div class="flex gap-2 mt-1">${renderPhoneButtons(person.nhanSu, null)}</div>
                    </div>
                </div>
            `}).join('');
        }
        
        html += `</div>`;
    } else {
        html += '<p class="text-gray-500">Không xác định ca</p>';
    }
    
    targetEl.innerHTML = html;
}

function renderOperationsDaySchedule(t4tcData, t4vhvData, selectedDate) {
    const key = dateToKey(selectedDate);
    const keyDisplay = formatDateWithDayOfWeek(key);
    
    // T4TC Day Schedule
    const t4tcDayData = t4tcData.lichTruc[key] || {};
    const t4tcEl = document.getElementById('operations-t4tc-day-schedule');
    let t4tcHtml = '';
    
    if (Object.keys(t4tcDayData).length === 0) {
        t4tcHtml = '<p class="text-gray-500">Không có dữ liệu</p>';
    } else {
        const caOrder = ['ca1', 'ca2', 'ca3'];
        const sortedCas = caOrder.filter(ca => ca in t4tcDayData);
        
        t4tcHtml = sortedCas.map(caCode => {
            const caStaff = t4tcDayData[caCode] || [];
            const caInfo = t4tcData.thongTinCa[caCode];
            return `<div class="mb-3 pb-3 border-b last:border-b-0">
                <p class="text-sm font-semibold text-blue-700 mb-2">${caCode.toUpperCase()} (${caInfo.gioBatDau} - ${caInfo.gioKetThuc})</p>
                ${caStaff.map(staff => `
                    <div class="bg-white px-2 py-1 mb-1 text-sm">
                        <p class="font-medium text-gray-800">${staff.nhanSu}</p>
                        <p class="text-xs text-gray-600">${staff.cuongVi}</p>
                    </div>
                `).join('')}
            </div>`;
        }).join('');
    }
    
    t4tcEl.innerHTML = t4tcHtml;
    
    // T4VHV Day Schedule
    const t4vhvDayData = t4vhvData.lichTruc[key] || {};
    const t4vhvEl = document.getElementById('operations-t4vhv-day-schedule');
    let t4vhvHtml = '';
    
    if (Object.keys(t4vhvDayData).length === 0) {
        t4vhvHtml = '<p class="text-gray-500">Không có dữ liệu</p>';
    } else {
        const caOrder = ['ca1', 'ca2', 'ca3'];
        const sortedCas = caOrder.filter(ca => ca in t4vhvDayData);
        
        t4vhvHtml = sortedCas.map(caCode => {
            const caStaff = t4vhvDayData[caCode] || [];
            const caInfo = t4vhvData.thongTinCa[caCode];
            return `<div class="mb-3 pb-3 border-b last:border-b-0">
                <p class="text-sm font-semibold text-green-700 mb-2">${caCode.toUpperCase()} (${caInfo.gioBatDau} - ${caInfo.gioKetThuc})</p>
                ${caStaff.map(staff => `
                    <div class="bg-white px-2 py-1 mb-1 text-sm">
                        <p class="font-medium text-gray-800">${staff.nhanSu}</p>
                        <p class="text-xs text-gray-600">${staff.cuongVi}</p>
                    </div>
                `).join('')}
            </div>`;
        }).join('');
    }
    
    t4vhvEl.innerHTML = t4vhvHtml;
}

function renderCVHDaySchedule(cvhData, selectedDate, targetElementId) {
    const key = dateToKey(selectedDate);
    const keyDisplay = formatDateWithDayOfWeek(key);
    
    const dayData = cvhData.lichTruc[key] || {};
    const targetEl = document.getElementById(targetElementId);
    let html = '';
    
    if (Object.keys(dayData).length === 0) {
        html = '<p class="text-gray-500">Không có dữ liệu</p>';
    } else {
        const caOrder = ['ca1', 'ca2', 'ca3'];
        const sortedCas = caOrder.filter(ca => ca in dayData);
        
        html = sortedCas.map(caCode => {
            const caStaff = dayData[caCode] || [];
            const sortedStaff = sortStaffByRole(caStaff);
            const caInfo = cvhData.thongTinCa[caCode];
            
            // Tách Trưởng Ca/Trưởng kíp riêng
            const leaders = sortedStaff.filter(person => {
                const colors = getColorForRole(person.cuongVi);
                return colors.leader === true;
            });
            const staff = sortedStaff.filter(person => {
                const colors = getColorForRole(person.cuongVi);
                return colors.leader !== true;
            });
            
            let caHtml = `<div class="mb-4 pb-4 border-b last:border-b-0">
                <p class="text-sm font-semibold text-teal-700 mb-3">${caCode.toUpperCase()} (${caInfo.gioBatDau} - ${caInfo.gioKetThuc})</p>`;
            
            // Hiển thị Trưởng Ca/Trưởng kíp nổi bật
            if (leaders.length > 0) {
                caHtml += `<div class="mb-3 pb-3 border-b-2 border-teal-200">`;
                caHtml += leaders.map(person => {
                    const colors = getColorForRole(person.cuongVi);
                    return `
                    <div class="staff-card ${colors.bg} px-4 py-3 mb-2 border-l-4 ${colors.border} rounded shadow-md">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-bold text-base ${colors.text}">${person.nhanSu}</p>
                                <p class="text-xs ${colors.text} font-semibold">${person.cuongVi}</p>
                            </div>
                            <div class="flex gap-2 mt-1">${renderPhoneButtons(person.nhanSu, null)}</div>
                        </div>
                    </div>
                `}).join('');
                caHtml += `</div>`;
            }
            
            // Hiển thị Vận Hành Viên
            if (staff.length > 0) {
                caHtml += staff.map(person => {
                    const colors = getColorForRole(person.cuongVi);
                    return `
                    <div class="staff-card ${colors.bg} px-3 py-2 mb-2 border-l-4 ${colors.border} rounded">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-medium ${colors.text}">${person.nhanSu}</p>
                                <p class="text-xs ${colors.text} opacity-75">${person.cuongVi}</p>
                            </div>
                            <div class="flex gap-2 mt-1">${renderPhoneButtons(person.nhanSu, null)}</div>
                        </div>
                    </div>
                `}).join('');
            }
            
            caHtml += `</div>`;
            return caHtml;
        }).join('');
    }
    
    targetEl.innerHTML = html;
}

function setupOperationsUI(t4tcData, t4vhvData) {
    const datePickerOps = document.getElementById('operations-date-picker');
    const selectedDateDisplayOps = document.getElementById('operations-selected-date-display');
    
    datePickerOps.value = dateToKey(new Date());
    
    const updateOpsDateDisplay = () => {
        if (selectedDateDisplayOps && datePickerOps.value) {
            selectedDateDisplayOps.textContent = formatDateWithDayOfWeek(datePickerOps.value);
        }
    };
    updateOpsDateDisplay();
    
    renderOperationsCurrentShift(t4tcData, t4vhvData);
    renderOperationsDaySchedule(t4tcData, t4vhvData, datePickerOps.value);
    
    const updateOpsOnDateChange = () => {
        updateOpsDateDisplay();
        renderOperationsDaySchedule(t4tcData, t4vhvData, datePickerOps.value);
    };
    
    datePickerOps.addEventListener('change', updateOpsOnDateChange);
    datePickerOps.addEventListener('input', updateOpsOnDateChange);
    
    setInterval(() => {
        renderOperationsCurrentShift(t4tcData, t4vhvData);
    }, 60000);
}

function setupCVHUI(cvhData, datePickerId, displayId, currentShiftDateId, currentId, dayScheduleId) {
    const datePicker = document.getElementById(datePickerId);
    const selectedDateDisplay = document.getElementById(displayId);
    const currentShiftDateEl = document.getElementById(currentShiftDateId);
    
    datePicker.value = dateToKey(new Date());
    
    const updateDateDisplay = () => {
        if (selectedDateDisplay && datePicker.value) {
            selectedDateDisplay.textContent = formatDateWithDayOfWeek(datePicker.value);
        }
    };
    updateDateDisplay();
    
    // Update header date for current shift
    const updateCurrentShiftDate = () => {
        if (currentShiftDateEl) {
            currentShiftDateEl.innerHTML = `Ngày hiện tại: <strong class="text-lg text-gray-800">${formatDateWithDayOfWeek(dateToKey(new Date()))}</strong>`;
        }
    };
    updateCurrentShiftDate();
    
    renderCVHCurrentShift(cvhData, currentId);
    renderCVHDaySchedule(cvhData, datePicker.value, dayScheduleId);
    
    const updateOnDateChange = () => {
        updateDateDisplay();
        renderCVHDaySchedule(cvhData, datePicker.value, dayScheduleId);
    };
    
    datePicker.addEventListener('change', updateOnDateChange);
    datePicker.addEventListener('input', updateOnDateChange);
    
    setInterval(() => {
        renderCVHCurrentShift(cvhData, currentId);
        updateCurrentShiftDate();
    }, 60000);
}

function mergeCVH3Data(t4tcData, t4vhvData) {
    const merged = {
        thongTinCa: t4vhvData.thongTinCa,
        lichTruc: {}
    };
    
    for (const dateKey in t4vhvData.lichTruc) {
        merged.lichTruc[dateKey] = {};
        
        for (const caCode in t4vhvData.lichTruc[dateKey]) {
            merged.lichTruc[dateKey][caCode] = [];
            
            const t4tcStaff = (t4tcData.lichTruc[dateKey] && t4tcData.lichTruc[dateKey][caCode]) || [];
            const t4vhvStaff = t4vhvData.lichTruc[dateKey][caCode] || [];
            
            merged.lichTruc[dateKey][caCode] = [...t4tcStaff, ...t4vhvStaff];
        }
    }
    
    return merged;
}

function renderDashboard(schedule, scheduleCoNhiet, cvh3Data, cvh4Data) {
    const todayKey = dateToKey(new Date());
    const todayDisplay = formatDateWithDayOfWeek(todayKey);

    const dateEl = document.getElementById('dashboard-date');
    if (dateEl) dateEl.innerHTML = `Ngày hiện tại: <strong class="text-lg text-gray-800">${todayDisplay}</strong>`;

    renderCurrentShift(schedule, 'dashboard-tsc-dien-ci');
    if (scheduleCoNhiet) renderCurrentShift(scheduleCoNhiet, 'dashboard-tsc-co-nhiet');
    else document.getElementById('dashboard-tsc-co-nhiet').innerHTML = '<p class="text-gray-500">Không có dữ liệu.</p>';

    if (cvh3Data) renderCVHCurrentShift(cvh3Data, 'dashboard-nt3');
    else document.getElementById('dashboard-nt3').innerHTML = '<p class="text-gray-500">Không có dữ liệu.</p>';

    if (cvh4Data) renderCVHCurrentShift(cvh4Data, 'dashboard-nt4');
    else document.getElementById('dashboard-nt4').innerHTML = '<p class="text-gray-500">Không có dữ liệu.</p>';
}

function switchTab(tabContentId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
    const content = document.getElementById(tabContentId);
    if (content) content.classList.remove('hidden');
    const btn = document.getElementById(tabContentId.replace('-content', '-btn'));
    if (btn) btn.classList.add('active');
    localStorage.setItem('activeTab', tabContentId);
}


(async function init() {
    const [schedule, scheduleCoNhiet, t4tcData, t4vhvData, t4cvh4Data, danhBaData] = await Promise.all([
        loadSchedule(),
        loadOperationsSchedule('Thang4Co.json'),
        loadOperationsSchedule('T4TC3.JSON'),
        loadOperationsSchedule('T4VHV.json'),
        loadOperationsSchedule('T4CVH4.json'),
        loadDanhBa(),
    ]);

    phoneBook = buildPhoneBook(danhBaData);

    if (!schedule) {
        document.getElementById('current-shift-info').textContent = 'Không tải được lịch. Vui lòng kiểm tra data/schedule.json.';
        return;
    }
    setupUI(schedule, scheduleCoNhiet);

    const cvh3MergedData = (t4tcData && t4vhvData) ? mergeCVH3Data(t4tcData, t4vhvData) : null;

    // Dashboard: Thông Tin Chung
    renderDashboard(schedule, scheduleCoNhiet, cvh3MergedData, t4cvh4Data);
    setInterval(() => renderDashboard(schedule, scheduleCoNhiet, cvh3MergedData, t4cvh4Data), 60000);

    // CVH 3: Merge T4TC3 (Trưởng Ca) + T4VHV (Vận Hành Viên)
    if (cvh3MergedData) {
        setupCVHUI(
            cvh3MergedData,
            'operations-date-picker',
            'operations-selected-date-display',
            'operations-cvh3-date',
            'operations-cvh3-current',
            'operations-cvh3-day-schedule'
        );
    } else {
        document.getElementById('operations-cvh3-current').textContent = 'Không tải được dữ liệu CVH 3 (T4TC3 hoặc T4VHV)';
    }
    // CVH 4: Single file
    if (t4cvh4Data) {
        setupCVHUI(
            t4cvh4Data,
            'operations4-date-picker',
            'operations4-selected-date-display',
            'operations-cvh4-date',
            'operations-cvh4-current',
            'operations-cvh4-day-schedule'
        );
    } else {
        document.getElementById('operations-cvh4-current').textContent = 'Không tải được dữ liệu CVH 4 (T4CVH4)';
    }
    
    // Restore last active tab (supports both new 'tab-X-content' and legacy 'tabX' format)
    const stored = localStorage.getItem('activeTab') || 'tab-0-content';
    const activeTabId = stored.includes('-content') ? stored : stored.replace('tab', 'tab-') + '-content';
    if (activeTabId !== 'tab-0-content') switchTab(activeTabId);
})();