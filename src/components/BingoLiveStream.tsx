"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  useLocalParticipant,
  VideoTrack,
  useRoomContext,
} from "@livekit/components-react";
import { Track, RoomEvent, DataPacket_Kind } from "livekit-client";
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
            Transmite la cámara de tu bolillero o comparte la pantalla con el sorteo digital.
            Tus jugadores verán cada bolilla en tiempo real sin salir de su cartón digital.
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
  const room = useRoomContext();
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const { localParticipant } = useLocalParticipant();
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Estados interactivos para Enfoque A (Escenario & Participantes)
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [iRaisedHand, setIRaisedHand] = useState(false);
  const [canSpeak, setCanSpeak] = useState(role === "publisher");
  const [speakAlert, setSpeakAlert] = useState<string | null>(null);

  // Escuchar mensajes de datos en tiempo real (Levantar la mano, Silenciar, Habilitar hablar)
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);

        if (data.type === "RAISE_HAND") {
          setRaisedHands((prev) => {
            const next = new Set(prev);
            if (data.raised) {
              next.add(data.identity);
            } else {
              next.delete(data.identity);
            }
            return next;
          });
        }

        if (data.type === "SPEECH_PERMISSION") {
          // Si este mensaje es para mí
          if (data.targetIdentity === localParticipant.identity) {
            if (data.allowed) {
              setCanSpeak(true);
              setSpeakAlert("🎙️ ¡El organizador te ha dado la palabra! Tu micrófono está listo para hablar.");
              localParticipant.setMicrophoneEnabled(true);
              setIsMicMuted(false);
            } else {
              setCanSpeak(false);
              setSpeakAlert("🔇 El organizador ha silenciado tu micrófono.");
              localParticipant.setMicrophoneEnabled(false);
              setIsMicMuted(true);
            }
            setTimeout(() => setSpeakAlert(null), 5000);
          }
        }

        if (data.type === "MUTE_ALL") {
          if (role !== "publisher") {
            setCanSpeak(false);
            localParticipant.setMicrophoneEnabled(false);
            setIsMicMuted(true);
            setSpeakAlert("🔇 El organizador ha silenciado la sala.");
            setTimeout(() => setSpeakAlert(null), 4000);
          }
        }
      } catch (e) {
        // Ignorar datos no JSON
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, localParticipant, role]);

  // Función para que el jugador levante/baje la mano
  const toggleRaiseHand = async () => {
    if (!room || role === "publisher") return;
    const nextState = !iRaisedHand;
    setIRaisedHand(nextState);

    const msg = JSON.stringify({
      type: "RAISE_HAND",
      identity: localParticipant.identity,
      raised: nextState,
    });
    const bytes = new TextEncoder().encode(msg);
    await room.localParticipant.publishData(bytes, { reliable: true });
  };

  // Función del organizador para dar o quitar micrófono a un jugador
  const toggleParticipantSpeech = async (targetIdentity: string, currentAllowed: boolean) => {
    if (!room || role !== "publisher") return;
    const msg = JSON.stringify({
      type: "SPEECH_PERMISSION",
      targetIdentity,
      allowed: !currentAllowed,
    });
    const bytes = new TextEncoder().encode(msg);
    await room.localParticipant.publishData(bytes, { reliable: true });
  };

  // Función del organizador para silenciar a todos
  const muteAllParticipants = async () => {
    if (!room || role !== "publisher") return;
    const msg = JSON.stringify({ type: "MUTE_ALL" });
    const bytes = new TextEncoder().encode(msg);
    await room.localParticipant.publishData(bytes, { reliable: true });
  };

  const toggleMic = async () => {
    if (role !== "publisher" && !canSpeak) return;
    const next = !isMicMuted;
    await localParticipant.setMicrophoneEnabled(!next);
    setIsMicMuted(next);
  };

  const toggleCam = async () => {
    if (role !== "publisher") return;
    const next = !isCamOff;
    await localParticipant.setCameraEnabled(!next);
    setIsCamOff(next);
  };

  const toggleScreenShare = async () => {
    if (role !== "publisher") return;
    try {
      const next = !isScreenSharing;
      await localParticipant.setScreenShareEnabled(next);
      setIsScreenSharing(next);
    } catch (e) {
      console.warn("Cancelado compartir pantalla", e);
      setIsScreenSharing(false);
    }
  };

  // Priorizar pantalla compartida si existe, sino cámara
  const screenTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.track
  );
  const cameraTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && t.publication?.track
  );
  const activeVideoTrack = screenTrack || cameraTrack;

  // Filtrado de participantes en la lista
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const name = (p.name || p.identity).toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    });
  }, [participants, searchQuery]);

  return (
    <div className="relative w-full bg-black flex flex-col justify-center select-none overflow-hidden">
      {/* Notificación flotante de palabra/silencio para el jugador */}
      {speakAlert && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-400 text-slate-950 px-4 py-2 rounded-2xl shadow-2xl font-black text-xs sm:text-sm animate-bounce border-2 border-white flex items-center gap-2">
          {speakAlert}
        </div>
      )}

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
        ) : activeVideoTrack && activeVideoTrack.publication?.track ? (
          <VideoTrack
            trackRef={activeVideoTrack}
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

              {/* Botón interactivo de conectados (Abre la lista de asistentes) */}
              <button
                type="button"
                onClick={() => setShowParticipantsModal(true)}
                title="Ver lista completa de jugadores en la sala"
                className="pointer-events-auto bg-slate-950/85 hover:bg-slate-900 backdrop-blur border border-slate-700/80 text-emerald-400 text-xs font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <span>👥 {participants.length} conectados</span>
                {raisedHands.size > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black animate-bounce">
                    ✋ {raisedHands.size}
                  </span>
                )}
              </button>

              {screenTrack && (
                <span className="bg-indigo-600/90 backdrop-blur text-white font-black text-[11px] px-2.5 py-0.5 rounded-full shadow border border-indigo-400/30">
                  🖥️ Pantalla Compartida
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Botón de levantar la mano para el jugador */}
              {role !== "publisher" && (
                <button
                  type="button"
                  onClick={toggleRaiseHand}
                  className={`text-xs font-black px-3 py-1.5 rounded-xl border backdrop-blur cursor-pointer shadow transition-all active:scale-95 flex items-center gap-1.5 ${
                    iRaisedHand
                      ? "bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/50"
                      : "bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700"
                  }`}
                >
                  <span>{iRaisedHand ? "✋ Mano Levantada" : "✋ Levantar Mano"}</span>
                </button>
              )}

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
        <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
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

            <button
              type="button"
              onClick={toggleScreenShare}
              className={`px-3 py-1.5 rounded-xl font-black cursor-pointer transition-all flex items-center gap-1.5 shadow ${
                isScreenSharing
                  ? "bg-amber-400 text-slate-950 border border-amber-300 ring-2 ring-amber-400/50"
                  : "bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40"
              }`}
            >
              {isScreenSharing ? "🛑 Dejar de Compartir" : "🖥️ Compartir Pantalla"}
            </button>

            <button
              type="button"
              onClick={() => setShowParticipantsModal(true)}
              className="px-3 py-1.5 rounded-xl font-black bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-all flex items-center gap-1.5 shadow"
            >
              👥 Ver Jugadores ({participants.length})
            </button>
          </div>

          <div className="text-slate-400 font-medium hidden md:block">
            🔴 Transmitiendo a todos los jugadores sin retraso
          </div>
        </div>
      )}

      {/* Barra de Controles para el Jugador si tiene permiso de hablar */}
      {role !== "publisher" && canSpeak && !isMinimized && (
        <div className="bg-emerald-950/80 border-t border-emerald-600/50 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-emerald-300 font-bold">🎙️ Tienes la palabra del Organizador:</span>
            <button
              type="button"
              onClick={toggleMic}
              className={`px-3 py-1 rounded-xl font-black cursor-pointer ${
                isMicMuted
                  ? "bg-red-600 text-white"
                  : "bg-emerald-500 text-slate-950"
              }`}
            >
              {isMicMuted ? "Activar Mi Voz" : "Silenciar Mi Voz"}
            </button>
          </div>
          <span className="text-emerald-400 text-[11px]">Todos los jugadores te escuchan</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL / PANEL DE PARTICIPANTES EN SALA (TIPO ZOOM / GOOGLE MEET)      */}
      {/* ===================================================================== */}
      {showParticipantsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Cabecera */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">👥</span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Jugadores Conectados en la Sala
                  </h3>
                  <p className="text-slate-400 text-xs">
                    {participants.length} conectados en tiempo real
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowParticipantsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Barra de Búsqueda y Botón Maestro Silenciar a Todos */}
            <div className="p-3 sm:p-4 border-b border-slate-800/80 space-y-2.5 bg-slate-900/60">
              <input
                type="text"
                placeholder="🔍 Buscar por nombre del comprador o número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />

              {role === "publisher" && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400 text-xs font-semibold">
                    Control de Sala:
                  </span>
                  <button
                    type="button"
                    onClick={muteAllParticipants}
                    className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    🔇 Silenciar a Todos
                  </button>
                </div>
              )}
            </div>

            {/* Lista de Participantes */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 divide-y divide-slate-800/40">
              {filteredParticipants.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No se encontraron participantes.
                </div>
              ) : (
                filteredParticipants.map((p) => {
                  const isHost = p.identity.startsWith("org_") || p.identity === "admin";
                  const isMe = p.identity === localParticipant.identity;
                  const hasHandRaised = raisedHands.has(p.identity);
                  const isSpeaking = p.isSpeaking;

                  return (
                    <div
                      key={p.identity}
                      className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${
                            isHost
                              ? "bg-indigo-600"
                              : hasHandRaised
                              ? "bg-amber-500 animate-pulse"
                              : "bg-slate-800 border border-slate-700"
                          }`}
                        >
                          {isHost ? "👑" : hasHandRaised ? "✋" : "👤"}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-100 truncate">
                              {p.name || p.identity}
                            </span>
                            {isMe && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-semibold">
                                Tú
                              </span>
                            )}
                            {isHost && (
                              <span className="text-[10px] bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 px-1.5 py-0.2 rounded font-black">
                                Organizador
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-[11px] flex items-center gap-2">
                            <span>ID: {p.identity}</span>
                            {isSpeaking && (
                              <span className="text-emerald-400 font-bold animate-pulse">
                                🔊 Hablando...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botones de Control para el Organizador */}
                      {role === "publisher" && !isHost && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleParticipantSpeech(p.identity, p.isMicrophoneEnabled)}
                            className={`px-2.5 py-1 rounded-lg font-black text-[11px] cursor-pointer transition-all shadow ${
                              p.isMicrophoneEnabled
                                ? "bg-red-600 text-white hover:bg-red-500"
                                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                            }`}
                          >
                            {p.isMicrophoneEnabled ? "🔇 Silenciar" : "🎙️ Dar Palabra"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie del modal */}
            <div className="p-3 sm:p-4 bg-slate-950/60 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowParticipantsModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
