import React from "react";

interface Props {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  tags?: string[]; // dynamic list of available tags from Firestore (optional)
}

const DEFAULT_TAGS = [
  "mental-health",
  "fitness",
  "nutrition",
  "chronic-disease",
  "medication",
  "environmental-health",
  "pandemic",
  "preventive-care",
  "women-health",
  "child-health",
  "aging",
  "sleep",
  "stress",
];

const PulseFilters: React.FC<Props> = ({ selectedTags, onTagsChange, tags }) => {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {(tags && tags.length > 0 ? tags : DEFAULT_TAGS).map((tag) => {
        const active = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border"
            }`}
            aria-pressed={active}
          >
            {tag.replace(/-/g, " ")}
          </button>
        );
      })}
    </div>
  );
};

export default PulseFilters;
