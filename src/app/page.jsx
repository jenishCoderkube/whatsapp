"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "../components/ui/Loader";
import { useAppSelector } from "../hooks/useRedux";

export default function RootPage() {
  const router = useRouter();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    // Add small simulated load delay for premium initial feel
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.push("/chat");
      } else {
        router.push("/login");
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  return <Loader fullScreen={true} />;
}
