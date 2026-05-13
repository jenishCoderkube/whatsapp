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
import { authService } from "../../services/authService";

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

  const handleLogin = async (e) => {
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

    // Execute backend authentication flow
    const result = await authService.login({ email, password });

    if (result.error) {
      console.log("result", result);

      dispatch(loginFailure(result.error));
      setValidationError(result.error);
    } else if (result.user) {
      dispatch(loginSuccess({ user: result.user }));
      router.push("/chat");
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-wa-sidebar selection:bg-wa-primary/20 select-none p-4 overflow-hidden relative transition-colors duration-200">
      {/* Top premium green background header strip mimicking desktop web onboarding */}
      <div className="absolute top-0 left-0 right-0 h-[222px] bg-wa-primary hidden md:block z-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md rounded-lg bg-wa-modal shadow-2xl border border-wa-border relative z-10 flex flex-col max-h-[90vh] overflow-hidden transition-colors duration-200"
      >
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {/* Brand presentation */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wa-primary text-white shadow-md mb-3">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-medium text-wa-text">
              Log in to WhatsApp Web
            </h2>
            <p className="text-xs text-wa-muted mt-1">
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
              <label className="block text-xs font-medium text-wa-muted mb-1.5">
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
                <label className="block text-xs font-medium text-wa-muted">
                  Password
                </label>
                <Link
                  href="/login"
                  onClick={() =>
                    alert("Simulated Password Reset sent to email.")
                  }
                  className="text-xs text-wa-primary hover:underline"
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
                  className="absolute right-3 text-wa-muted hover:text-wa-text"
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
                  className="h-4 w-4 rounded accent-wa-primary"
                />
                <span className="text-xs text-wa-muted">Remember me</span>
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
          <div className="mt-6 pt-4 border-t border-wa-border text-center text-xs text-wa-muted">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="text-wa-primary font-medium hover:underline"
            >
              Register here
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
