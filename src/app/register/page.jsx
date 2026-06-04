"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Upload,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Avatar } from "../../components/ui/Avatar";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import { useTranslation } from "../../hooks/useTranslation";
import { loginStart, registerSuccess, loginFailure } from "../../redux/slices/authSlice";
import { authService } from "../../services/authService";
import { storageService } from "../../services/storageService";
import { cn } from "../../utils/cn";

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const loading = useAppSelector((state) => state.auth.loading);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const user = useAppSelector((state) => state.auth.user);

  // AUTH ROUTE PROTECTION: Redirect already authenticated sessions away from public auth boundaries
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      router.replace("/chat");
    }
  }, [isAuthenticated, user?.id, router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [socialLoading, setSocialLoading] = useState(null);

  const handleGoogleSignup = async () => {
    setValidationError("");
    setSocialLoading("google");
    const result = await authService.signInWithGoogle();
    if (result.error) {
      setValidationError(result.error);
      setSocialLoading(null);
    }
  };

  const handleGitHubSignup = async () => {
    setValidationError("");
    setSocialLoading("github");
    const result = await authService.signInWithGitHub();
    if (result.error) {
      setValidationError(result.error);
      setSocialLoading(null);
    }
  };

  const fileInputRef = useRef(null);

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

  // Cleanup object URLs on unmount or preview changes
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setValidationError("Profile image must be less than 5MB in size.");
      return;
    }

    setValidationError("");
    setAvatarFile(file);

    // Revoke old blob URL to avoid memory leak
    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }

    // Create a local blob URL for instant preview without uploading immediately
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    e.target.value = "";
  };

  const triggerAvatarInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setValidationError("");

    if (!name.trim()) {
      setValidationError(t("auth.enter_full_name"));
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setValidationError(t("auth.invalid_email"));
      return;
    }
    if (password.length < 6) {
      setValidationError(t("auth.password_min_length"));
      return;
    }
    if (password !== confirmPassword) {
      setValidationError(t("auth.passwords_do_not_match"));
      return;
    }
    if (!termsAccepted) {
      setValidationError(t("auth.accept_terms_error"));
      return;
    }

    dispatch(loginStart());
    if (avatarFile) {
      setIsUploadingAvatar(true);
    }

    try {
      // Execute absolute backend signup workflow storing profile fields dynamically after authenticating
      const result = await authService.register({
        email,
        password,
        name,
        avatar: avatarPreview && !avatarPreview.startsWith("blob:") ? avatarPreview : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        avatarFile,
      });

      if (result.error) {
        dispatch(loginFailure(result.error));
        setValidationError(result.error);
      } else if (result.user) {
        dispatch(registerSuccess({ user: result.user }));
        router.push("/chat");
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-wa-sidebar selection:bg-wa-primary/20 select-none p-4 overflow-hidden relative transition-colors duration-200">
      {/* Top green background header strip */}
      <div className="absolute top-0 left-0 right-0 h-[222px] bg-wa-primary hidden md:block z-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md rounded-lg bg-wa-modal shadow-2xl border border-wa-border relative z-10 flex flex-col max-h-[90vh] overflow-hidden transition-colors duration-200"
      >
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {/* Header Title section */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wa-primary text-white shadow-md mb-3">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-medium text-wa-text">
              {t("auth.register_title")}
            </h2>
            <p className="text-xs text-wa-muted mt-1">
              {t("auth.register_subtitle")}
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

          {/* Hidden avatar file chooser dialog */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarFileSelect}
            accept="image/*"
            className="hidden"
          />

          {/* Registration form block */}
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {/* Realtime Supabase Storage Avatar selector */}
            <div className="flex flex-col items-center justify-center py-2">
              <div
                className="relative group cursor-pointer block rounded-full"
                onClick={triggerAvatarInput}
              >
                <Avatar
                  src={avatarPreview}
                  fallback={name[0] || "U"}
                  size="xl"
                  className="shadow-sm ring-2 ring-wa-border"
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-wa-modal/80 backdrop-blur-xs">
                    <Loader2 className="h-6 w-6 text-wa-primary animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={triggerAvatarInput}
                disabled={isUploadingAvatar}
                className="text-[11px] text-wa-primary hover:underline mt-1.5 font-medium cursor-pointer"
              >
                {isUploadingAvatar
                  ? t("auth.uploading_image")
                  : avatarPreview
                  ? t("auth.change_photo")
                  : t("auth.upload_image")}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-wa-muted mb-1.5">
                {t("auth.full_name_label")}
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

            <div>
              <label className="block text-xs font-medium text-wa-muted mb-1.5">
                {t("auth.password_label")}
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
                                : "bg-wa-primary"
                            : "bg-transparent"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-wa-muted mt-1 block">
                    {strengthScore <= 1
                      ? t("auth.weak_password")
                      : strengthScore === 2
                        ? t("auth.medium_password")
                        : t("auth.strong_password")}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-wa-muted mb-1.5">
                {t("auth.confirm_password_label")}
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
                  className="mt-0.5 h-4 w-4 rounded accent-wa-primary shrink-0"
                />
                <span className="text-wa-muted leading-tight">
                  {t("auth.agree_terms_prefix")}
                  <Link
                    href="/register"
                    onClick={() => alert("Terms of Service summary.")}
                    className="text-wa-primary hover:underline"
                  >
                    {t("auth.terms_of_service")}
                  </Link>
                  {t("auth.agree_terms_suffix")}
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="default"
              className="w-full mt-2"
              isLoading={loading}
              disabled={socialLoading !== null}
            >
              {t("auth.register_title").split(" ")[0] || "Register"}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-5 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-wa-border"></div>
            </div>
            <span className="relative bg-wa-modal px-3 text-[10px] uppercase text-wa-muted tracking-wider">
              {t("auth.or_continue_with") || "Or continue with"}
            </span>
          </div>

          {/* Social Auth Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 font-semibold text-xs rounded-md bg-wa-hover hover:bg-wa-active text-wa-text border border-wa-border flex items-center justify-center shrink-0 shadow-sm transition-all duration-200"
              onClick={handleGoogleSignup}
              isLoading={socialLoading === "google"}
              disabled={loading || socialLoading !== null}
            >
              {socialLoading !== "google" && (
                <svg className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.126C18.305 1.63 15.535 1 12.24 1 5.983 1 12.24 5.983 1 12.24s4.983 11.24 11.24 11.24c6.536 0 10.874-4.593 10.874-11.087 0-.746-.08-1.32-.176-1.793H12.24z"></path>
                </svg>
              )}
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 font-semibold text-xs rounded-md bg-wa-hover hover:bg-wa-active text-wa-text border border-wa-border flex items-center justify-center shrink-0 shadow-sm transition-all duration-200"
              onClick={handleGitHubSignup}
              isLoading={socialLoading === "github"}
              disabled={loading || socialLoading !== null}
            >
              {socialLoading !== "github" && (
                <svg className="mr-2 h-4 w-4 shrink-0 fill-current text-wa-text" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
                </svg>
              )}
              GitHub
            </Button>
          </div>

          {/* Login navigation router */}
          <div className="mt-6 pt-4 border-t border-wa-border text-center text-xs text-wa-muted">
            {t("auth.already_have_account")}{" "}
            <Link
              href="/login"
              className="text-wa-primary font-medium hover:underline"
            >
               {t("auth.login_here")}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
