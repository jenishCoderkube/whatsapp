"use client";

import React from "react";
import { CircleDashed } from "lucide-react";
import { motion } from "framer-motion";

import { useTranslation } from "../../hooks/useTranslation";

export function StatusEmptyState() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center p-8 text-[#8696a0]"
    >
      <div className="h-28 w-28 bg-[#202c33]/50 rounded-full flex items-center justify-center border border-[#8696a0]/15 shadow-inner mb-6 animate-pulse">
        <CircleDashed className="h-16 w-16 text-[#8696a0]/30 stroke-[1.5]" />
      </div>
      <h2 className="text-lg font-medium text-[#e9edef] mb-1">
        {t("status.click_to_view")}
      </h2>
      <p className="text-xs text-[#8696a0] max-w-sm text-center leading-relaxed">
        {t("status.updates_visible_desc")}
      </p>
    </motion.div>
  );
}
