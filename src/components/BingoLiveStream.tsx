"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  useLocalParticipant,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

interface BingoLiveStreamProps {
  roomName: string; // eventId
  role: "publisher" | "viewer";
  identity: string;
  displayName: string;
  playerToken?: string;
  defaultCollapsed?: boolean;
}

export default function BingoLiveStream({
  roomName,
  role,
  identity,
  displayName,
  playerToken,
  defaultCollapsed = false,
}: BingoLiveStreamProps) {
  const [token, setToken] = useState<string>("");
  const [serverUrl, setServerUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(defaultCollapsed);

  useEffect(() => {
    // Si es organizador, no conecta hasta que pulse "Transmitir"
    if (role === "publisher" && !isBroadcasting) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const url = `/api/live/token?room=${encodeURIComponent(
      roomName
    )}&identity=${encodeURIComponent(identity)}&name=${encodeURIComponent(
      displayName
    )}&role=${role}${playerToken ? `&token=${encodeURIComponent(playerToken)}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setToken(data.token);
          setServerUrl(data.url);
        }
      })
      .catch(() => {
        setError("No se pudo conectar con el servidor de video en vivo.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [roomName, role, identity, displayName, playerToken, isBroadcasting]);

  // Si es Organizador y aún no ha iniciado la transmisión
  if (role === "publisher" && !isBroadcasting) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center text-3xl sm:text-4xl shadow-xl shadow-emerald-500/20 animate-bounce">
          📹
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Transmisión Ultra Rápida WebRTC (&lt; 0.5s)
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Cámara Oficial del Bolillero en Vivo
          </h3>
          <p className="text-slate-300 text-sm sm:text-base max-w-lg mx-auto mt-2 leading-relaxed">
            Transmite el bolillero físico o digital directamente desde esta pantalla.
            Tus jugadores verán cada bolilla salir en tiempo real sin salir de su cartón digital.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsBroadcasting(true)}
            className="group relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black px-8 py-4 rounded-2xl text-base sm:text-lg shadow-xl shadow-red-500/30 transition-all duration-200 active:scale-95 cursor-pointer border border-red-400/30"
          >
            <span className="w-3 h-3 rounded-full bg-white animate-ping"></span>
            🔴 Iniciar Transmisión en Vivo Ahora
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-slate-950/80 backdrop-blur border border-slate-800 rounded-3xl p-6 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-300 font-bold text-sm tracking-wide">
          🔄 Conectando a la sala en vivo (WebRTC)...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 text-center text-amber-300 text-sm font-bold flex items-center justify-center gap-2">
        <span>⚠️</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!token || !serverUrl) return null;

  return (
    <div className="w-full overflow-hidden rounded-3xl border-2 border-emerald-500 bg-slate-950 shadow-2xl relative transition-all duration-300">
      <LiveKitRoom
        video={role === "publisher"}
        audio={role === "publisher"}
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        style={{ height: "100%", width: "100%" }}
      >
        <RoomAudioRenderer />
        <VideoStage
          role={role}
          isMinimized={isMinimized}
          onToggleMinimize={() => setIsMinimized((prev) => !prev)}
          onStop={role === "publisher" ? () => setIsBroadcasting(false) : undefined}
        />
      </LiveKitRoom>
    </div>
  );
}

function VideoStage({
  role,
  isMinimized,
  onToggleMinimize,
  onStop,
}: {
  role: "publisher" | "viewer";
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onStop?: () => void;
}) {
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  // Si es publisher, usamos useLocalParticipant para control de mic/cam
  const localParticipantHook = useLocalParticipant();
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  const toggleMic = async () => {
    if (role !== "publisher") return;
    const next = !isMicMuted;
    await localParticipantHook.localParticipant.setMicrophoneEnabled(!next);
    setIsMicMuted(next);
  };

  const toggleCam = async () => {
    if (role !== "publisher") return;
    const next = !isCamOff;
    await localParticipantHook.localParticipant.setCameraEnabled(!next);
    setIsCamOff(next);
  };

  const cameraTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && t.publication?.track
  );

  return (
    <div className="relative w-full bg-black flex flex-col justify-center select-none overflow-hidden">
      {/* Contenedor del video con altura dinámica si está minimizado */}
      <div
        className={`relative w-full flex items-center justify-center bg-slate-950 transition-all duration-300 ${
          isMinimized ? "h-14" : "aspect-video sm:max-h-[380px]"
        }`}
      >
        {isMinimized ? (
          <div className="w-full h-full px-4 flex items-center justify-between bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-white font-black text-xs sm:text-sm">
                🔴 TRANSMISIÓN EN CURSO (BOLILLERO EN VIVO)
              </span>
              <span className="text-slate-400 text-xs font-semibold hidden sm:inline">
                • {participants.length} en sala
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleMinimize}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-md transition-transform active:scale-95"
            >
              📺 Ver Video
            </button>
          </div>
        ) : cameraTrack && cameraTrack.publication?.track ? (
          <VideoTrack
            trackRef={cameraTrack}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center p-6 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center text-2xl animate-pulse shadow-inner">
              📹
            </div>
            <p className="text-slate-200 font-black text-sm sm:text-base">
              {role === "publisher"
                ? "Iniciando tu cámara..."
                : "Esperando que el organizador encienda la cámara..."}
            </p>
            <p className="text-slate-400 text-xs max-w-xs mx-auto">
              {role === "publisher"
                ? "Asegúrate de permitir el acceso al navegador."
                : "La imagen del bolillero aparecerá aquí en cuanto empiece el sorteo."}
            </p>
          </div>
        )}

        {/* Overlay informativo y controles solo cuando está expandido */}
        {!isMinimized && (
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            <div className="flex items-center gap-2">
              <span className="bg-red-600/95 backdrop-blur text-white font-black text-[11px] sm:text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg border border-red-400/40">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                EN VIVO
              </span>
              <span className="bg-slate-950/85 backdrop-blur border border-slate-700/80 text-emerald-400 text-xs font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                👥 {participants.length}{" "}
                <span className="text-slate-300 font-normal hidden sm:inline">
                  conectados
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Botón para minimizar/plegar en teléfonos */}
              <button
                type="button"
                onClick={onToggleMinimize}
                title="Minimizar video para ver solo cartones"
                className="bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-700 backdrop-blur cursor-pointer transition-colors"
              >
                🔽 Plegar
              </button>

              {role === "publisher" && onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className="bg-red-600 hover:bg-red-500 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-lg cursor-pointer transition-transform active:scale-95"
                >
                  ⏹ Detener
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Barra de Controles Inferior para el Organizador */}
      {role === "publisher" && !isMinimized && (
        <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMic}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5 ${
                isMicMuted
                  ? "bg-red-600/20 text-red-400 border border-red-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              }`}
            >
              {isMicMuted ? "🔇 Micrófono Silenciado" : "🎙️ Micrófono Activo"}
            </button>

            <button
              type="button"
              onClick={toggleCam}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5 ${
                isCamOff
                  ? "bg-red-600/20 text-red-400 border border-red-500/40"
                  : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
              }`}
            >
              {isCamOff ? "🚫 Cámara Apagada" : "📹 Cámara Activa"}
            </button>
          </div>

          <div className="text-slate-400 font-medium hidden sm:block">
            🔴 Transmitiendo a todos los jugadores sin retraso
          </div>
        </div>
      )}
    </div>
  );
}
