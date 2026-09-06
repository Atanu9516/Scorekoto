"use client";

export default function DateSelector({ selectedDate, setSelectedDate }) {
    return (
        <div className="date-selector">

            <button
                onClick={() => setSelectedDate("yesterday")}
                className={selectedDate === "yesterday" ? "selected-date" : ""}
            >
                Yesterday
            </button>

            <button
                onClick={() => setSelectedDate("today")}
                className={selectedDate === "today" ? "selected-date" : ""}
            >
                Today
            </button>

            <button
                onClick={() => setSelectedDate("tomorrow")}
                className={selectedDate === "tomorrow" ? "selected-date" : ""}
            >
                Tomorrow
            </button>

        </div>
    );
}