const SHIFT_DEFINITIONS = {
    O: { label: 'O', description: 'Trực qua điện thoại ngoài giờ hành chính + on-site khi có sự cố', dayWindow: [['00:00','24:00']] },
    X: { label: 'X', description: 'Giờ hành chính, điều động theo chuyên môn khi có sự cố', dayWindow: [['08:00','17:00']] },
    WO: { label: 'WO', description: 'Giờ hành chính + on-call đêm 18:00-06:00', dayWindow: [['08:00','17:00'], ['18:00','06:00']] },
    D: { label: 'D', description: 'Ca ngày 06:00-18:00', dayWindow:[['06:00','18:00']] },
    N: { label: 'N', description: 'Ca đêm 18:00-06:00', dayWindow:[['18:00','06:00']] },
};

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
    const result = [];

    entries.forEach((entry) => {
        const parsed = parseScheduleEntry(entry);
        if (!parsed || parsed.code === 'X') return; // bỏ ca giờ hành chính X

        if (parsed.code) {
            const def = SHIFT_DEFINITIONS[parsed.code];
            if (!def) return;
            const isOnDuty = def.dayWindow.some(([s, e]) => inTimeWindow(now, s, e));
            if (isOnDuty) {
                result.push({ code: parsed.code, role: def.description, name: parsed.name });
            }
        } else if (parsed.name) {
            result.push({ code: '??', role: 'Không xác định ca', name: parsed.name });
        }
    });

    return result;
}

function dateToKey(date) {
    const d = new Date(date);
    if (isNaN(d)) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getAssignmentsForDate(schedule, dateKey, excludeX = false) {
    const entries = (schedule && schedule[dateKey]) || [];
    return Array.isArray(entries)
        ? entries
              .map((entry) => parseScheduleEntry(entry))
              .filter((item) => item && (!excludeX || item.code !== 'X'))
        : [];
}

function renderCurrentShift(schedule) {
    const todayKey = dateToKey(new Date());
    const currentList = getCurrentOnDuty(schedule, todayKey);
    const wrap = document.getElementById('current-shift-info');
    if (currentList.length === 0) {
        wrap.innerHTML = `<p class="text-gray-600">Ngày hiện tại: <strong class="text-lg text-gray-800">${todayKey}</strong></p><p class="text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200 mt-2">⚠️ Hiện tại không ai trực (có thể nghỉ, mã không rõ hoặc ngoài ca).</p>`;
        return;
    }

    wrap.innerHTML = `<p class="text-gray-600 mb-3">Ngày hiện tại: <strong class="text-lg text-gray-800">${todayKey}</strong></p><ul class="space-y-2">` +
        currentList.map((item) => `<li class="px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded"><span class="font-bold text-red-900 text-lg">${item.name || '(không tên)'}</span><br><span class="text-sm text-red-700 font-medium">${item.code} - ${item.role}</span></li>`).join('') +
        '</ul>';
}

function renderDaySchedule(schedule, selectedDate) {
    const key = dateToKey(selectedDate);
    const assignments = getAssignmentsForDate(schedule, key, true); // loại bỏ X
    const el = document.getElementById('day-schedule');

    if (assignments.length === 0) {
        el.innerHTML = `<p class="text-gray-600">Ngày <strong>${key}</strong> không có ai trực (trừ ca X).</p>`;
        return;
    }

    el.innerHTML = `<p class="text-sm text-gray-600 mb-3">Ngày chọn: <strong class="text-lg text-gray-800">${key}</strong></p><ul class="space-y-2">` +
        assignments.map((item) => `<li class="px-3 py-2 bg-white border-l-4 border-green-400 rounded"><span class="font-semibold text-gray-800">${item.name || '(Không tên)'}</span> - <span class="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">${item.code || '(Unknown code)'}</span> <span class="text-gray-600 text-sm">${item.code ? SHIFT_DEFINITIONS[item.code]?.description : ''}</span></li>`).join('') +
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
    if (parsed && parsed.code) return parsed.code;
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

    let html = `<h3 class="text-lg font-semibold text-gray-800 mb-3">Tuần ${dateToKey(monday)} - ${dateToKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6))} <span class="text-blue-600">${person}</span></h3>`;
    html += '<div class="overflow-x-auto"><table class="w-full border-collapse"><thead><tr class="bg-blue-50"><th class="border border-gray-300 px-3 py-2 font-semibold text-gray-700">Thứ</th><th class="border border-gray-300 px-3 py-2 font-semibold text-gray-700">Ngày</th><th class="border border-gray-300 px-3 py-2 font-semibold text-gray-700">Ca Trực</th></tr></thead><tbody>';

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = dateToKey(d);
        const code = getPersonCode(schedule, key, person);
        const label = code ? `<span class="font-semibold">${code}</span><br><span class="text-xs text-gray-600">${SHIFT_DEFINITIONS[code]?.description || 'Không xác định'}</span>` : '<span class="text-gray-400">Nghỉ</span>';
        const cssClass = code ? 'cell-' + code.toLowerCase() : 'cell-off';
        html += `<tr class="${cssClass}"><td class="border border-gray-300 px-3 py-2 text-center font-medium">${['T2','T3','T4','T5','T6','T7','CN'][i]}</td><td class="border border-gray-300 px-3 py-2 text-center text-sm">${key}</td><td class="border border-gray-300 px-3 py-2 text-center">${label}</td></tr>`;
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
    html += '<div class="overflow-x-auto"><table class="w-full border-collapse"><thead><tr class="bg-purple-50"><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">CN</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T2</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T3</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T4</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T5</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T6</th><th class="border border-gray-300 px-2 py-2 font-semibold text-gray-700 text-center">T7</th></tr></thead><tbody><tr>';

    // start empty until first day
    for (let i = 0; i < (startDow === 0 ? 0 : startDow); i++) html += '<td class="border border-gray-300 h-20 bg-gray-100"></td>';

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const key = dateToKey(date);
        const code = getPersonCode(schedule, key, person);
        const label = code ? `<span class="font-semibold text-sm">${code}</span>` : '';
        const cssClass = code ? 'cell-' + code.toLowerCase() : 'cell-off';

        html += `<td class="border border-gray-300 h-20 p-2 align-top ${cssClass}"><span class="font-bold text-lg text-gray-800 block">${d}</span><span class="text-center block text-xs">${label}</span></td>`;

        if (date.getDay() === 6 && d < daysInMonth) html += '</tr><tr>';
    }

    // fill trailing empty cells
    const lastDate = new Date(year, month, daysInMonth).getDay();
    if (lastDate !== 6) {
        for (let j = lastDate + 1; j <= 6; j++) html += '<td class="border border-gray-300 h-20 bg-gray-100"></td>';
    }

    html += '</tr></tbody></table></div>';

    document.getElementById('month-schedule').innerHTML = html;
}

function setupUI(schedule) {
    const datePicker = document.getElementById('date-picker');
    const personSelect = document.getElementById('person-select');
    const selectedPersonDiv = document.getElementById('selected-person');
    const searchInput = document.getElementById('person-search');
    
    if (!datePicker.value) datePicker.value = dateToKey(new Date());

    setupPersonSearch(schedule);

    renderCurrentShift(schedule);
    renderDaySchedule(schedule, datePicker.value);

    // Load previously selected person from localStorage
    const savedPerson = localStorage.getItem('selectedPerson');
    if (savedPerson) {
        searchInput.value = savedPerson;
        personSelect.value = savedPerson;
        selectedPersonDiv.textContent = `✓ Đã chọn: ${savedPerson}`;
        selectedPersonDiv.classList.remove('hidden');
        // Auto-render both week and month for previously selected person
        renderWeekSchedule(schedule, datePicker.value, savedPerson);
        renderMonthSchedule(schedule, datePicker.value, savedPerson);
    }

    // Auto-render day schedule when date changes
    datePicker.addEventListener('change', () => {
        renderDaySchedule(schedule, datePicker.value);
        const person = personSelect.value;
        if (person) {
            renderWeekSchedule(schedule, datePicker.value, person);
            renderMonthSchedule(schedule, datePicker.value, person);
        }
    });

    setInterval(() => renderCurrentShift(schedule), 60000);
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

(async function init() {
    const schedule = await loadSchedule();
    if (!schedule) {
        document.getElementById('current-shift-info').textContent = 'Không tải được lịch. Vui lòng kiểm tra data/schedule.json.';
        return;
    }
    setupUI(schedule);
})();