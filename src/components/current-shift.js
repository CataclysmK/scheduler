import React, { useEffect, useState } from 'react';

const CurrentShift = () => {
    const [currentShift, setCurrentShift] = useState(null);

    useEffect(() => {
        const fetchSchedule = async () => {
            const response = await fetch('./data/schedule.json');
            const data = await response.json();
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0];
            const currentTime = now.getHours() * 60 + now.getMinutes();

            const shifts = data.shifts.filter(shift => 
                shift.date === currentDate && 
                currentTime >= shift.startTime && 
                currentTime < shift.endTime
            );

            if (shifts.length > 0) {
                setCurrentShift(shifts[0]);
            } else {
                setCurrentShift({ name: 'No one is currently on shift' });
            }
        };

        fetchSchedule();
    }, []);

    return (
        <div className="current-shift">
            <h2>Current Shift</h2>
            {currentShift ? (
                <div>
                    <p>Name: {currentShift.name}</p>
                    <p>Shift Time: {currentShift.startTime} - {currentShift.endTime}</p>
                </div>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default CurrentShift;