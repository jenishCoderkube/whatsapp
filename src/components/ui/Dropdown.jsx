"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../utils/cn";

export function Dropdown({ 
  trigger, 
  items = [], 
  align = "right", 
  className, 
  closeOnMouseLeave = false,
  isOpen: controlledIsOpen,
  onOpenChange
}) {
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef(null);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : localIsOpen;

  const setIsOpen = (val) => {
    if (isControlled) {
      if (onOpenChange) onOpenChange(val);
    } else {
      setLocalIsOpen(val);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isControlled, onOpenChange]);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // If the trigger element is near the bottom of the screen (within 200px), open upward!
      if (rect.bottom > viewportHeight - 200) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
    setIsOpen(!isOpen);
  };

  return (
    <div 
      className="relative inline-block text-left" 
      ref={dropdownRef}
      onMouseLeave={() => {
        if (closeOnMouseLeave) {
          setIsOpen(false);
        }
      }}
    >
      <div
        onClick={handleToggle}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: openUpward ? 5 : -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: openUpward ? 5 : -5 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className={cn(
              "absolute z-50 w-48 rounded-sm bg-wa-modal py-2 shadow-lg border border-wa-border transition-colors",
              openUpward ? "bottom-full mb-2" : "top-full mt-2",
              align === "right" ? "right-0" : "left-0",
              className
            )}
          >
            {items.map((item, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  if (item.onClick) item.onClick(e);
                }}
                className={cn(
                  "block w-full px-4 py-2 text-left text-sm text-wa-text hover:bg-wa-hover transition-colors",
                  item.danger && "text-red-500 hover:text-red-600"
                )}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
