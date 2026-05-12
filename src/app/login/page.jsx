"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, MessageSquare, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import {
  loginStart,
  loginSuccess,
  loginFailure,
} from "../../redux/slices/authSlice";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const loading = useAppSelector((state) => state.auth.loading);
  const error = useAppSelector((state) => state.auth.error);

  const [email, setEmail] = useState("demo@whatsapp.web");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [validationError, setValidationError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    setValidationError("");

    if (!email.trim() || !email.includes("@")) {
      setValidationError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters long.");
      return;
    }

    dispatch(loginStart());

    // Simulate safe server API call verification
    setTimeout(() => {
      dispatch(loginSuccess({ email }));
      router.push("/chat");
    }, 1000);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f0f2f5] dark:bg-[#111b21] selection:bg-[#00a884]/20 select-none p-4 overflow-hidden relative">
      {/* Top premium green background header strip mimicking desktop web onboarding */}
      <div className="absolute top-0 left-0 right-0 h-[222px] bg-[#00a884] hidden md:block z-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md rounded-lg bg-white dark:bg-[#202c33] shadow-2xl border border-black/5 dark:border-white/5 relative z-10 flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {/* Brand presentation */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00a884] text-white shadow-md mb-3">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-medium text-[#111b21] dark:text-[#e9edef]">
              Log in to WhatsApp Web
            </h2>
            <p className="text-xs text-[#667781] dark:text-[#8696a0] mt-1">
              Enter your credentials to access your linked conversations
            </p>
          </div>

          {/* Validation alert banners */}
          {(validationError || error) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs border border-red-100 dark:border-red-900"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError || error}</span>
            </motion.div>
          )}

          {/* Form engine */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-[#54656f] dark:text-[#aebac1] mb-1.5">
                Email Address
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#54656f] dark:text-[#aebac1]">
                  Password
                </label>
                <Link
                  href="/login"
                  onClick={() =>
                    alert("Simulated Password Reset sent to email.")
                  }
                  className="text-xs text-[#00a884] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative flex items-center">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#00a884]"
                />
                <span className="text-xs text-[#54656f] dark:text-[#aebac1]">
                  Remember me
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="default"
              className="w-full mt-2"
              isLoading={loading}
            >
              Log In
            </Button>
          </form>

          {/* Route transitions redirection */}
          <div className="mt-6 pt-4 border-t border-[#e9edef] dark:border-[#222d34] text-center text-xs text-[#54656f] dark:text-[#aebac1]">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="text-[#00a884] font-medium hover:underline"
            >
              Register here
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
