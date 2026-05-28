"use client";

import { useState, useRef, useEffect } from "react";

export function useAudioRecorder({ t, onSend, onError }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone permission denied or device error:", err);
      if (onError) {
        onError(t("chat.mic_access_denied"));
      }
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      } catch (e) {}
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const sendVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        try {
          mediaRecorderRef.current.stream
            .getTracks()
            .forEach((track) => track.stop());
        } catch (e) {}

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setIsRecording(false);
        const finalDurationSeconds = recordingDuration;
        setRecordingDuration(0);
        audioChunksRef.current = [];

        if (audioBlob.size < 100 || finalDurationSeconds < 1) {
          if (onError) {
            onError(t("chat.voice_recording_short"));
          }
          return;
        }

        const mins = Math.floor(finalDurationSeconds / 60);
        const secs = finalDurationSeconds % 60;
        const durationStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

        const voiceFile = new File(
          [audioBlob],
          `voice_note_${Date.now()}.webm`,
          { type: "audio/webm" }
        );

        if (onSend) {
          onSend(voiceFile, durationStr);
        }
      };

      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        } catch (e) {}
      }
    };
  }, []);

  return {
    isRecording,
    recordingDuration,
    startVoiceRecording,
    cancelVoiceRecording,
    sendVoiceRecording,
  };
}
