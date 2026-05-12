"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Upload,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Avatar } from "../../components/ui/Avatar";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { loginStart, registerSuccess } from "../../redux/slices/authSlice";
import { cn } from "../../utils/cn";

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const loading = useAppSelector((state) => state.auth.loading);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Calculate simulated password strength metric
  const calculateStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    return score; // Max 4
  };

  const strengthScore = calculateStrength();

  const handleRegister = (e) => {
    e.preventDefault();
    setValidationError("");

    if (!name.trim()) {
      setValidationError("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setValidationError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }
    if (!termsAccepted) {
      setValidationError("You must accept the Terms of Service to register.");
      return;
    }

    dispatch(loginStart());

    setTimeout(() => {
      dispatch(
        registerSuccess({
          name,
          email,
          avatar:
            avatarPreview ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        }),
      );
      router.push("/chat");
    }, 1200);
  };

  // Simulate file upload with mock preset assets
  const handleSimulatedUpload = () => {
    const urls = [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    ];
    const randomUrl = urls[Math.floor(Math.random() * urls.length)];
    setAvatarPreview(randomUrl);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f0f2f5] dark:bg-[#111b21] selection:bg-[#00a884]/20 select-none p-4 overflow-hidden relative">
      {/* Top green background header strip */}
      <div className="absolute top-0 left-0 right-0 h-[222px] bg-[#00a884] hidden md:block z-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md rounded-lg bg-white dark:bg-[#202c33] shadow-2xl border border-black/5 dark:border-white/5 relative z-10 flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {/* Header Title section */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00a884] text-white shadow-md mb-3">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-medium text-[#111b21] dark:text-[#e9edef]">
              Create an Account
            </h2>
            <p className="text-xs text-[#667781] dark:text-[#8696a0] mt-1">
              Join WhatsApp Web to instantly message and link contacts
            </p>
          </div>

          {/* Validation Error banner */}
          {validationError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs border border-red-100 dark:border-red-900"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </motion.div>
          )}

          {/* Registration form block */}
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {/* Asset Avatar selector */}
            <div className="flex flex-col items-center justify-center py-2">
              <div
                className="relative group cursor-pointer"
                onClick={handleSimulatedUpload}
              >
                <Avatar
                  src={avatarPreview}
                  fallback={name[0] || "U"}
                  size="xl"
                  className="shadow-sm"
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="h-5 w-5 text-white" />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSimulatedUpload}
                className="text-[11px] text-[#00a884] hover:underline mt-1.5"
              >
                {avatarPreview
                  ? "Change profile photo"
                  : "Upload profile image"}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#54656f] dark:text-[#aebac1] mb-1.5">
                Full Name
              </label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
              />
            </div>

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
              <label className="block text-xs font-medium text-[#54656f] dark:text-[#aebac1] mb-1.5">
                Password
              </label>
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

              {/* Dynamic password strength meter */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1 w-full rounded-full overflow-hidden bg-black/5 dark:bg-white/5">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          "flex-1 transition-all duration-300",
                          strengthScore >= level
                            ? strengthScore <= 1
                              ? "bg-red-500"
                              : strengthScore === 2
                                ? "bg-amber-500"
                                : "bg-[#00a884]"
                            : "bg-transparent",
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[#667781] dark:text-[#8696a0] mt-1 block">
                    {strengthScore <= 1
                      ? "Weak password"
                      : strengthScore === 2
                        ? "Medium password"
                        : "Strong password"}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#54656f] dark:text-[#aebac1] mb-1.5">
                Confirm Password
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {/* Terms support */}
            <div className="pt-1">
              <label className="flex items-start gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#00a884] shrink-0"
                />
                <span className="text-[#54656f] dark:text-[#aebac1] leading-tight">
                  I agree to the WhatsApp Web Clone{" "}
                  <Link
                    href="/register"
                    onClick={() => alert("Terms of Service summary.")}
                    className="text-[#00a884] hover:underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and Privacy Policy.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="default"
              className="w-full mt-2"
              isLoading={loading}
            >
              Register
            </Button>
          </form>

          {/* Login navigation router */}
          <div className="mt-6 pt-4 border-t border-[#e9edef] dark:border-[#222d34] text-center text-xs text-[#54656f] dark:text-[#aebac1]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[#00a884] font-medium hover:underline"
            >
              Log in here
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
