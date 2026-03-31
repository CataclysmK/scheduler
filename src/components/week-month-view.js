import React, { useState, useEffect } from 'react';
import scheduleData from '../data/schedule.json';

const WeekMonthView = () => {
    const [view, setView] = useState('month'); // 'week' or 'month'
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [shifts, setShifts] = useState([]);

    useEffect(() => {
        loadShifts();
    }, [selectedDate, view]);

    const loadShifts = () => {
        const month = selectedDate.getMonth();
        const year = selectedDate.getFullYear();
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const filteredShifts = scheduleData.filter(shift => {
            const shiftDate = new Date(shift.date);
            return view === 'month'
                ? shiftDate.getMonth() === month && shiftDate.getFullYear() === year
                : shiftDate >= startOfWeek && shiftDate <= endOfWeek;
        });

        setShifts(filteredShifts);
    };

    const handleDateChange = (event) => {
        setSelectedDate(new Date(event.target.value));
    };

    const toggleView = () => {
        setView(view === 'month' ? 'week' : 'month');
    };

    return (
        <div>
            <h2>{view === 'month' ? 'Monthly Schedule' : 'Weekly Schedule'}</h2>
            <input type="date" onChange={handleDateChange} />
            <button onClick={toggleView}>
                Switch to {view === 'month' ? 'Week' : 'Month'} View
            </button>
            <ul>
                {shifts.map(shift => (
                    <li key={shift.id}>
                        {shift.date}: {shift.personnel.join(', ')}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default WeekMonthView;