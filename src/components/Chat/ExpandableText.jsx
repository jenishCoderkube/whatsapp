"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { cn } from "../../utils/cn";

// Simple client-side cache for link previews
const linkPreviewCache = {};

function LinkPreviewCard({ url }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!url) return;

    if (linkPreviewCache[url]) {
      setPreview(linkPreviewCache[url]);
      return;
    }

    setLoading(true);
    setError(false);

    const fetchPreview = async () => {
      try {
        const cleanUrl = url.trim();
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(cleanUrl)}`);
        if (!res.ok) throw new Error("Failed to load preview");
        
        const data = await res.json();
        if (data && !data.error) {
          linkPreviewCache[url] = data;
          setPreview(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.warn("Fetch link preview failed:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 p-2 bg-black/5 dark:bg-white/5 border-l-4 border-wa-primary rounded text-xs select-none animate-pulse">
        {t("chat.loading_preview") || "Loading Link Preview..."}
      </div>
    );
  }

  if (error || !preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-3 bg-black/5 dark:bg-white/5 border-l-4 border-wa-primary p-2 rounded text-xs select-none hover:bg-black/10 dark:hover:bg-white/10 transition-colors block text-left"
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt="Preview"
          className="h-12 w-12 object-cover rounded shrink-0 bg-black/10"
        />
      )}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-wa-muted font-sans font-medium uppercase tracking-wider block truncate">
          {preview.siteName || preview.domain || t("chat.link_preview")}
        </span>
        <p className="font-semibold text-wa-primary truncate mt-0.5">
          {preview.title}
        </p>
        {preview.description && (
          <p className="text-wa-muted truncate text-[11px] mt-0.5">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

function LinkPreviewFinder({ text }) {
  const firstUrlMatch = text.match(/(https?:\/\/[^\s\n]+|www\.[^\s\n]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}(?:\/[^\s\n]*)?)/i);
  const firstUrl = firstUrlMatch ? firstUrlMatch[0] : null;

  if (!firstUrl) return null;
  return <LinkPreviewCard url={firstUrl} />;
}

const parseFormattedText = (text, groupMembers = [], onMentionClick) => {
  if (!text) return "";

  const sortedMembers = [...groupMembers].sort((a, b) => b.name.length - a.name.length);
  const urlPattern = /https?:\/\/[^\s\n]+|www\.[^\s\n]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}(?:\/[^\s\n]*)?/gi;
  const escapeRegex = (string) => string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");

  const matches = [];

  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    matches.push({
      type: "url",
      text: match[0],
      index: match.index,
      length: match[0].length
    });
  }

  sortedMembers.forEach(member => {
    const nameEscaped = escapeRegex(member.name);
    const mentionPattern = new RegExp(`@${nameEscaped}\\b`, "gi");
    let mMatch;
    while ((mMatch = mentionPattern.exec(text)) !== null) {
      const isOverlapping = matches.some(existing => 
        (mMatch.index >= existing.index && mMatch.index < existing.index + existing.length) ||
        (mMatch.index + mMatch[0].length > existing.index && mMatch.index + mMatch[0].length <= existing.index + existing.length)
      );
      
      if (!isOverlapping) {
        matches.push({
          type: "mention",
          text: mMatch[0],
          member,
          index: mMatch.index,
          length: mMatch[0].length
        });
      }
    }
  });

  matches.sort((a, b) => a.index - b.index);

  const tokens = [];
  let cursor = 0;

  matches.forEach((m) => {
    if (m.index > cursor) {
      tokens.push({ type: "text", text: text.slice(cursor, m.index) });
    }
    tokens.push(m);
    cursor = m.index + m.length;
  });

  if (cursor < text.length) {
    tokens.push({ type: "text", text: text.slice(cursor) });
  }

  const formatMarkdown = (txt) => {
    const parts = txt.split(/(\*[^\*\s][^\*]*[^\*\s]\*|\*[^\*\s]\*|_[^\_\s][^\_]*[^\_\s]_|_[^\_\s]_|~[^~\s][^~]*[^~\s]~|~[^~\s]~)/g);
    
    return parts.map((part, i) => {
      if (i % 2 === 0) return part;
      
      const char = part[0];
      const innerText = part.slice(1, -1);
      
      if (char === "*") {
        return <strong key={i} className="font-bold">{innerText}</strong>;
      }
      if (char === "_") {
        return <em key={i} className="italic">{innerText}</em>;
      }
      if (char === "~") {
        return <span key={i} className="line-through opacity-80">{innerText}</span>;
      }
      return part;
    });
  };

  return tokens.map((token, idx) => {
    if (token.type === "text") {
      return <React.Fragment key={idx}>{formatMarkdown(token.text)}</React.Fragment>;
    }
    if (token.type === "url") {
      let href = token.text;
      if (!/^https?:\/\//i.test(href)) {
        href = "https://" + href;
      }
      return (
        <a
          key={idx}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 dark:text-blue-400 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {token.text}
        </a>
      );
    }
    if (token.type === "mention") {
      return (
        <span
          key={idx}
          onClick={(e) => {
            e.stopPropagation();
            if (onMentionClick) onMentionClick(token.member);
          }}
          className="text-wa-primary font-semibold hover:underline cursor-pointer bg-wa-primary/10 px-1 py-0.5 rounded animate-pulse-subtle"
        >
          {token.text}
        </span>
      );
    }
    return null;
  });
};

const CHARACTER_LIMIT = 500;
const LINE_LIMIT = 8;

export function ExpandableText({ text, groupMembers, onMentionClick, isCaption = false, noPreview = false }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  const lines = text.split("\n");
  const isTooLong = text.length > CHARACTER_LIMIT || lines.length > LINE_LIMIT;

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const formattedText = parseFormattedText(text, groupMembers, onMentionClick);

  if (!isTooLong) {
    return (
      <div className="flex flex-col">
        <p className={cn("text-wa-text leading-snug whitespace-pre-wrap break-words", isCaption ? "text-xs sm:text-sm mt-1.5" : "text-sm sm:text-base")}>
          {formattedText}
        </p>
        {!isCaption && !noPreview && <LinkPreviewFinder text={text} />}
      </div>
    );
  }

  let displayText;
  if (!isExpanded) {
    if (text.length > CHARACTER_LIMIT) {
      displayText = text.slice(0, CHARACTER_LIMIT) + "...";
    } else {
      displayText = lines.slice(0, LINE_LIMIT).join("\n") + "\n...";
    }
  } else {
    displayText = text;
  }

  const renderedText = parseFormattedText(displayText, groupMembers, onMentionClick);

  return (
    <div className="flex flex-col">
      <p className={cn("text-wa-text leading-snug whitespace-pre-wrap break-words", isCaption ? "text-xs sm:text-sm mt-1.5" : "text-sm sm:text-base")}>
        {renderedText}
      </p>
      <button
        onClick={handleToggle}
        className="text-xs font-semibold text-wa-primary hover:underline self-start mt-1 focus:outline-none cursor-pointer"
      >
        {isExpanded ? (t("chat.read_less") || "Read less") : (t("chat.read_more") || "Read more")}
      </button>
      {!isCaption && !noPreview && !isExpanded && <LinkPreviewFinder text={displayText} />}
      {!isCaption && !noPreview && isExpanded && <LinkPreviewFinder text={text} />}
    </div>
  );
}
