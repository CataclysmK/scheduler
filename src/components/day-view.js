import React, { useState, useEffect } from 'react';
import scheduleData from '../data/schedule.json';

const DayView = ({ selectedDate }) => {
    const [shifts, setShifts] = useState([]);

    useEffect(() => {
        const dateString = selectedDate.toISOString().split('T')[0];
        const dailyShifts = scheduleData.filter(shift => shift.date === dateString);
        setShifts(dailyShifts);
    }, [selectedDate]);

    return (
        <div className="day-view">
            <h2>Schedule for {selectedDate.toDateString()}</h2>
            {shifts.length > 0 ? (
                <ul>
                    {shifts.map((shift, index) => (
                        <li key={index}>
                            {shift.person} - {shift.start} to {shift.end}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No shifts scheduled for this day.</p>
            )}
        </div>
    );
};

export default DayView;