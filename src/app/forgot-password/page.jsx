"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, MessageSquare, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useTranslation } from "../../hooks/useTranslation";
import { authService } from "../../services/authService";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [step, setStep] = useState("request"); // "request" | "otp" | "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email.trim() || !email.includes("@")) {
      setError(t("auth.invalid_email") || "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    const result = await authService.sendPasswordReset(email);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("A recovery link and verification code have been sent to your email.");
      setTimeout(() => {
        setStep("otp");
        setSuccess("");
      }, 1500);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (otp.length < 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    const result = await authService.verifyRecoveryOTP({ email, token: otp });
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Code verified successfully! You can now set your new password.");
      setTimeout(() => {
        setStep("reset");
        setSuccess("");
      }, 1500);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError(t("auth.password_min_length") || "Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwords_do_not_match") || "Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await authService.updatePassword(password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(t("auth.reset_success") || "Your password has been updated successfully. Redirecting to login...");
      await authService.logout();
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-wa-sidebar selection:bg-wa-primary/20 select-none p-4 overflow-hidden relative transition-colors duration-200">
      <div className="absolute top-0 left-0 right-0 h-[222px] bg-wa-primary hidden md:block z-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md rounded-lg bg-wa-modal shadow-2xl border border-wa-border relative z-10 flex flex-col max-h-[90vh] overflow-hidden transition-colors duration-200"
      >
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wa-primary text-white shadow-md mb-3">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-medium text-wa-text">
              {step === "request" && (t("auth.forgot_password_title") || "Reset Password")}
              {step === "otp" && (t("auth.otp_label") || "Verification Code")}
              {step === "reset" && (t("auth.new_password_title") || "Set New Password")}
            </h2>
            <p className="text-xs text-wa-muted mt-1 max-w-[280px]">
              {step === "request" && (t("auth.forgot_password_subtitle") || "Enter your email to receive a recovery code or reset link.")}
              {step === "otp" && (t("auth.enter_otp_subtitle")?.replace("{email}", email) || `We sent a 6-digit recovery code to ${email}.`)}
              {step === "reset" && (t("auth.new_password_subtitle") || "Choose a strong password to secure your account.")}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs border border-red-100 dark:border-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 text-xs border border-green-100 dark:border-green-900">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {step === "request" && (
            <form onSubmit={handleRequestReset} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-wa-muted mb-1.5">
                  {t("auth.email_label")}
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              <Button
                type="submit"
                variant="default"
                className="w-full mt-2"
                isLoading={loading}
              >
                {t("auth.send_reset_btn") || "Send Recovery Code & Link"}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-wa-muted mb-1.5">
                  {t("auth.otp_label") || "Verification Code"}
                </label>
                <Input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="text-center tracking-widest text-lg font-bold"
                />
              </div>

              <Button
                type="submit"
                variant="default"
                className="w-full mt-2"
                isLoading={loading}
              >
                {t("auth.verify_otp_btn") || "Verify Code"}
              </Button>

              <button
                type="button"
                onClick={() => setStep("request")}
                className="mt-2 text-xs text-wa-primary hover:underline flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("common.back") || "Back"}
              </button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-wa-muted mb-1.5">
                  {t("auth.new_password_label") || "New Password"}
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
                    className="absolute right-3 text-wa-muted hover:text-wa-text"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-wa-muted mb-1.5">
                  {t("auth.confirm_new_password_label") || "Confirm New Password"}
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Button
                type="submit"
                variant="default"
                className="w-full mt-2"
                isLoading={loading}
              >
                {t("auth.update_password_btn") || "Update Password"}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-wa-border text-center text-xs text-wa-muted">
            <Link
              href="/login"
              className="text-wa-primary font-medium hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              {t("auth.back_to_login") || "Back to login"}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
