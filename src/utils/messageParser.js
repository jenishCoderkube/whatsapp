/**
 * Unified parser to decode reactions, replies, and forwarding markers from message strings,
 * ensuring robust client-side storage fallback compatibility with older Supabase databases.
 */
export function parseMessageText(rawText) {
  let text = rawText || "";
  let reactions = {};
  let replyTo = null;
  let isForwarded = false;
  let noPreview = false;

  // 1. Check for Forwarded prefix
  if (text.startsWith("|||FWD|||")) {
    isForwarded = true;
    text = text.slice(9);
  }

  // 2. Check for NoPreview flag
  if (text.includes("|||NP|||")) {
    noPreview = true;
    text = text.replace("|||NP|||", "");
  }

  // 3. Check for reactions suffix (must handle both order combinations safely)
  if (text.includes("|||R:")) {
    const parts = text.split("|||R:");
    text = parts[0];
    try {
      reactions = JSON.parse(parts[1] || "{}");
    } catch (e) {}
  }

  // 4. Check for reply_to suffix
  if (text.includes("|||ReplyTo:")) {
    const parts = text.split("|||ReplyTo:");
    text = parts[0];
    try {
      replyTo = JSON.parse(parts[1] || "null");
    } catch (e) {}
  }

  return { text, reactions, replyTo, isForwarded, noPreview };
}

/**
 * Encodes clean message strings with reply and reaction payloads for backwards compatibility.
 */
export function encodeMessageText(cleanText, replyTo = null, isForwarded = false, reactions = {}, noPreview = false) {
  let encoded = cleanText || "";
  
  if (noPreview) {
    encoded = encoded + "|||NP|||";
  }
  
  if (isForwarded) {
    encoded = "|||FWD|||" + encoded;
  }
  
  if (replyTo) {
    encoded = encoded + "|||ReplyTo:" + JSON.stringify(replyTo);
  }
  
  if (reactions && Object.keys(reactions).length > 0) {
    encoded = encoded + "|||R:" + JSON.stringify(reactions);
  }
  
  return encoded;
}
