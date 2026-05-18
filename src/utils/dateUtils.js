/**
 * WhatsApp-style date and time formatting utilities.
 */

export const parseTimeStringToDate = (timeStr) => {
  if (!timeStr) return null;
  const d = new Date(timeStr);
  if (!isNaN(d.getTime())) return d;

  // Match HH:MM or HH:MM AM/PM
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (match) {
    let [_, hours, minutes, ampm] = match;
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
      if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
    }
    
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
  return null;
};

export const formatMessageTime = (dateInput) => {
  if (!dateInput) return "";
  let date = new Date(dateInput);
  
  if (isNaN(date.getTime())) {
    const parsed = parseTimeStringToDate(dateInput);
    if (parsed) {
      date = parsed;
    } else {
      return dateInput;
    }
  }

  return date.toLocaleTimeString([], { 
    hour: "2-digit", 
    minute: "2-digit",
    hour12: true 
  }).toUpperCase();
};

export const formatSidebarDate = (dateInput) => {
  if (!dateInput) return "";
  let date = new Date(dateInput);
  
  if (isNaN(date.getTime())) {
    const parsed = parseTimeStringToDate(dateInput);
    if (parsed) {
      date = parsed;
    } else {
      return dateInput;
    }
  }

  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  const isToday = date.toDateString() === now.toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return formatMessageTime(date);
  } else if (isYesterday) {
    return "Yesterday";
  } else if (diffDays < 7) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[date.getDay()];
  } else {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
};

export const getChatDateLabel = (dateInput) => {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return "Today";
  } else if (isYesterday) {
    return "Yesterday";
  } else {
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return days[date.getDay()];
    } else {
      return date.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
    }
  }
};
