"use client";

import React from "react";
import { Avatar } from "../ui/Avatar";

export function MentionSuggestions({ query, contacts, onSelect }) {
  const filtered = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-20 left-4 right-4 max-h-48 overflow-y-auto bg-[#233138] border border-white/10 rounded-lg shadow-xl z-30 flex flex-col divide-y divide-white/5 select-none">
      {filtered.map((contact) => (
        <button
          key={contact.id}
          onClick={() => onSelect(contact)}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left text-white w-full transition-colors cursor-pointer"
        >
          <Avatar src={contact.avatar} fallback={contact.name[0]} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{contact.name}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
