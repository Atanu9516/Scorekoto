"use client";

const matchTypes = [
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "finished", label: "Finished" },
];

export default function MatchTypeSelector({ selectedType, setSelectedType }) {
  return (
    <div className="match-type-selector" aria-label="Match type">
      {matchTypes.map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => setSelectedType(type.id)}
          className={selectedType === type.id ? "selected-type" : ""}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}
