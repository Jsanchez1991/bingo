"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
import BingoTableCard from "@/components/BingoTableCard";
import {
  BingoCardSheet,
  BingoGameState,
  BingoClaim,
} from "@/lib/bingo-store";
import {
  STAGES,
  TABLE_LETTERS,
  formatBall,
  validateTablePattern,
} from "@/lib/bingo-patterns";
import {
  announceBallVoice,
  announceCustomVoice,
  playDaubPop,
} from "@/lib/bingo-audio";

export default function PlayerBingoPage() {
  const params = useParams();
  const token = String(params?.token || "juego-00001");

  const [deviceId, setDeviceId] = useState<string>("");
  const [gameState, setGameState] = useState<BingoGameState | null>(null);
  // Todas las hojas/tablas de 6 juegos compradas por este mismo cliente
  const [playerCards, setPlayerCards] = useState<BingoCardSheet[]>([]);
  const [accessAllowed, setAccessAllowed] = useState<boolean>(true);
  const [clientIp, setClientIp] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // null = Vista de Hoja(s) Completa(s) de 6 juegos; 1..6 = Vista enfocada en ese Juego (T#1..T#6)
  const [zoomedTable, setZoomedTable] = useState<number | null>(null);
  const [qrByCard, setQrByCard] = useState<Record<string, string>>({});
  const [claimBanner, setClaimBanner] = useState<string | null>(null);
  const [submittingCardNum, setSubmittingCardNum] = useState<string | null>(
    null
  );
  const [drawingTieBall, setDrawingTieBall] = useState<boolean>(false);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const prevLastBallRef = useRef<number | null>(null);
  const isFirstFetchRef = useRef<boolean>(true);

  useEffect(() => {
    const storageKey = "gran_bingo_device_id";
    let stored = localStorage.getItem(storageKey);
    if (!stored) {
      stored =
        "DEV-" +
        Math.random().toString(36).substring(2, 10).toUpperCase() +
        "-" +
        Date.now().toString(36).toUpperCase();
      localStorage.setItem(storageKey, stored);
    }
    setDeviceId(stored);
  }, []);

  // Generar códigos QR para cada hoja comprada por el cliente
  useEffect(() => {
    if (playerCards.length === 0) return;
    playerCards.forEach((c) => {
      if (qrByCard[c.cardNumber]) return;
      const verifyPayload =
        typeof window !== "undefined"
          ? `${window.location.origin}/jugar/${c.secretToken}?verificar=${c.cardNumber}`
          : `GRAN-BINGO-JUEGO-${c.cardNumber}`;
      QRCode.toDataURL(verifyPayload, {
        width: 160,
        margin: 1,
      })
        .then((url) =>
          setQrByCard((prev) => ({ ...prev, [c.cardNumber]: url }))
        )
        .catch(() => {});
    });
  }, [playerCards, qrByCard]);

  const fetchLiveState = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await fetch(
        `/api/bingo?token=${encodeURIComponent(
          token
        )}&deviceId=${encodeURIComponent(deviceId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setErrorMsg("No se encontró este cartón de Bingo. Verifica tu enlace.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const newState: BingoGameState = data.state;

      const currentLastBall =
        newState.drawnBalls.length > 0
          ? newState.drawnBalls[newState.drawnBalls.length - 1]
          : null;

      if (!isFirstFetchRef.current) {
        if (
          currentLastBall !== null &&
          currentLastBall !== prevLastBallRef.current
        ) {
          announceBallVoice(currentLastBall, soundEnabled);
        }
      } else {
        isFirstFetchRef.current = false;
      }
      prevLastBallRef.current = currentLastBall;

      setGameState(newState);
      setPlayerCards(
        data.playerCards && data.playerCards.length > 0
          ? data.playerCards
          : data.card
          ? [data.card]
          : []
      );
      setAccessAllowed(data.accessAllowed);
      setClientIp(data.clientIp || "");
      setErrorMsg(null);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [token, deviceId, soundEnabled]);

  useEffect(() => {
    if (!deviceId) return;
    fetchLiveState();
    const timer = setInterval(fetchLiveState, 1500);
    return () => clearInterval(timer);
  }, [deviceId, fetchLiveState]);

  const handleToggleNumber = async (
    cardNumber: string,
    tableIndex: number,
    num: number
  ) => {
    if (soundEnabled) {
      playDaubPop();
    }
    const key = String(tableIndex);

    // Actualización optimista en la hoja correspondiente del cliente
    setPlayerCards((prevCards) =>
      prevCards.map((c) => {
        if (c.cardNumber !== cardNumber) return c;
        const currentList = c.markedByTable[key] || [];
        const exists = currentList.includes(num);
        const updatedList = exists
          ? currentList.filter((n) => n !== num)
          : [...currentList, num];
        return {
          ...c,
          markedByTable: {
            ...c.markedByTable,
            [key]: updatedList,
          },
        };
      })
    );

    await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "MARK_NUMBER",
        token,
        cardNumber,
        tableIndex,
        number: num,
      }),
    });
  };

  // Pintar automáticamente las bolillas salidas en TODAS las tablas abiertas de ese número de juego
  const handleAutoPaintGameAcrossAllSheets = async (tableIndex: number) => {
    if (!gameState || playerCards.length === 0) return;
    const drawnSet = new Set(gameState.drawnBalls);

    for (const c of playerCards) {
      const tableObj = c.tables.find((t) => t.tableIndex === tableIndex);
      if (!tableObj) continue;
      const currentMarked = new Set(c.markedByTable[String(tableIndex)] || []);
      for (let r = 0; r < 5; r++) {
        for (let col = 0; col < 5; col++) {
          const val = tableObj.grid[r][col];
          if (val > 0 && drawnSet.has(val) && !currentMarked.has(val)) {
            await handleToggleNumber(c.cardNumber, tableIndex, val);
          }
        }
      }
    }
  };

  const handleSendClaim = async (cardNumber: string, tableIndex: number) => {
    if (!gameState || submittingCardNum) return;
    setSubmittingCardNum(cardNumber);
    try {
      const res = await fetch("/api/bingo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_CLAIM",
          token,
          cardNumber,
          tableIndex,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setGameState(data.state);
        setClaimBanner(
          data.message ||
            `¡Enviado! Tu Tabla #${tableIndex} del Cartón #${cardNumber} ya está en la pantalla del organizador.`
        );
        announceCustomVoice(
          `¡Bingo enviado del Cartón ${Number(cardNumber)}!`,
          soundEnabled
        );
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {}
      }
    } finally {
      setSubmittingCardNum(null);
    }
  };

  const handleDrawTieBreakBall = async (cardNumber: string) => {
    if (drawingTieBall) return;
    setDrawingTieBall(true);
    try {
      const res = await fetch("/api/bingo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DRAW_TIE_BREAK_BALL",
          cardNumber,
          drawnBy: "JUGADOR",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setGameState(data.state);
        try {
          confetti({
            particleCount: 100,
            spread: 90,
            origin: { y: 0.5 },
          });
        } catch {}
      }
    } finally {
      setDrawingTieBall(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h1 className="text-2xl sm:text-3xl font-black">
          Abriendo tus Cartones de Gran Bingo...
        </h1>
        <p className="text-slate-300 mt-2 text-lg">
          Conectando en tiempo real con la sala del sorteo
        </p>
      </div>
    );
  }

  const primaryCard = playerCards[0];

  if (errorMsg || !gameState || !primaryCard) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-600/20 border-2 border-red-500 rounded-3xl p-8 max-w-md">
          <h1 className="text-3xl font-black mb-3">⚠️ Enlace no válido</h1>
          <p className="text-lg text-slate-200 mb-6">{errorMsg}</p>
          <a
            href="/"
            className="inline-block bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-xl text-lg"
          >
            Ir a la página principal
          </a>
        </div>
      </div>
    );
  }

  if (!accessAllowed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border-4 border-amber-400 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl sm:text-3xl font-black text-amber-400 mb-3">
            CARTÓN EN USO EN OTRO TELÉFONO
          </h1>
          <p className="text-lg sm:text-xl text-slate-200 leading-relaxed mb-4">
            Los cartones de{" "}
            <strong className="text-emerald-400">
              {primaryCard.buyerName}
            </strong>{" "}
            (
            <strong className="text-white font-black">
              {playerCards.map((c) => `#${c.cardNumber}`).join(", ")}
            </strong>
            ) ya están abiertos en otro dispositivo.
          </p>
          <div className="bg-slate-800 rounded-2xl p-4 text-left text-sm sm:text-base text-slate-300 mb-6 space-y-1 border border-slate-700">
            <p>
              <strong>Seguridad Anti-Copia:</strong> Solo se permite 1 teléfono
              activo por enlace de WhatsApp.
            </p>
            <p>
              <strong>IP registrada del dueño:</strong>{" "}
              {primaryCard.sessionLock?.ipAddress || "Activa"}
            </p>
            <p>
              <strong>Tu IP actual:</strong> {clientIp}
            </p>
          </div>
          <p className="text-base text-slate-300">
            ¿Se te apagó el celular y cambiaste de teléfono? Pídele al{" "}
            <strong>Organizador</strong> que presione el botón{" "}
            <span className="text-amber-300 font-bold">
              &ldquo;🔓 Liberar Dispositivo&rdquo;
            </span>{" "}
            para tu cuenta.
          </p>
        </div>
      </div>
    );
  }

  const hasMultipleSheets = playerCards.length > 1;
  const myCardNumbersSet = new Set(playerCards.map((c) => c.cardNumber));
  const activeStageInfo = STAGES[gameState.activeStage];
  const activeLetterInfo = TABLE_LETTERS[gameState.activeTable];
  const lastBall =
    gameState.drawnBalls.length > 0
      ? gameState.drawnBalls[gameState.drawnBalls.length - 1]
      : null;
  const previousBalls = gameState.drawnBalls.slice(0, -1).slice(-5).reverse();

  const activeTieBreak = gameState.tieBreak?.active ? gameState.tieBreak : null;
  const myPendingTieCandidates =
    activeTieBreak?.candidates.filter(
      (c) => myCardNumbersSet.has(c.cardNumber) && c.drawnNumber === null
    ) || [];

  return (
    <div className="print-wrapper min-h-screen bg-slate-100 pb-20">
      {/* ===================================================================== */}
      {/* CINTILLO EN VIVO SUPERIOR (SIEMPRE VISIBLE Y CON LETRAS GIGANTES)     */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-30 bg-slate-950 text-white shadow-xl border-b-4 border-amber-400 no-print">
        <div className="max-w-6xl mx-auto px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="bg-emerald-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-base sm:text-xl shadow-md">
                TABLA #{gameState.activeTable} ({activeLetterInfo?.title})
              </div>
              <div>
                <div className="text-xs sm:text-sm uppercase tracking-wider text-amber-300 font-extrabold">
                  JUGANDO AHORA EN VIVO:
                </div>
                <div className="text-lg sm:text-2xl font-black text-white leading-tight">
                  {activeStageInfo.shortLabel} •{" "}
                  <span className="text-amber-300">
                    {gameState.currentPrizeName}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={() => {
                  const nextVal = !soundEnabled;
                  setSoundEnabled(nextVal);
                  if (nextVal && lastBall) {
                    announceBallVoice(lastBall, true);
                  }
                }}
                className={`px-3 py-2 rounded-xl font-black text-xs sm:text-sm border-2 transition-all cursor-pointer ${
                  soundEnabled
                    ? "bg-emerald-600 text-white border-emerald-300"
                    : "bg-slate-800 text-slate-400 border-slate-600"
                }`}
              >
                {soundEnabled ? "🔊 Voz ON" : "🔇 Mudo"}
              </button>

              <div
                onClick={() => {
                  if (lastBall) announceBallVoice(lastBall, true);
                }}
                title="Toca para volver a escuchar la última bolilla"
                className="flex items-center gap-2 bg-slate-900 border-2 border-slate-700 rounded-2xl px-3 py-1.5 cursor-pointer hover:border-amber-400"
              >
                <div className="text-right">
                  <div className="text-[11px] sm:text-xs font-bold text-slate-300 uppercase">
                    Última Bolilla
                  </div>
                  <div className="text-xs text-amber-400 font-extrabold">
                    Total: {gameState.drawnBalls.length} salidas
                  </div>
                </div>
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-slate-950 border-4 border-white shadow-lg flex items-center justify-center font-black text-xl sm:text-2xl">
                  {lastBall ? formatBall(lastBall) : "--"}
                </div>
              </div>

              {previousBalls.length > 0 && (
                <div className="hidden md:flex items-center gap-1.5">
                  {previousBalls.map((b) => (
                    <span
                      key={b}
                      className="w-11 h-11 rounded-full bg-slate-800 border border-slate-600 text-white font-extrabold text-sm flex items-center justify-center"
                    >
                      {formatBall(b)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {gameState.drawnBalls.length > 0 && (
            <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-sm">
              <span className="text-slate-400 font-bold shrink-0 text-xs sm:text-sm">
                Salieron:
              </span>
              {gameState.drawnBalls
                .slice()
                .reverse()
                .slice(0, 12)
                .map((b, idx) => (
                  <span
                    key={b}
                    className={`px-2.5 py-0.5 rounded-full font-black shrink-0 ${
                      idx === 0
                        ? "bg-amber-400 text-slate-950 text-base"
                        : "bg-slate-800 text-slate-100 text-sm"
                    }`}
                  >
                    {formatBall(b)}
                  </span>
                ))}
            </div>
          )}
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MODAL EN VIVO: SORTEO DE DESEMPATE "AL NÚMERO MAYOR"                  */}
      {/* ===================================================================== */}
      {activeTieBreak && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-slate-900 border-4 border-amber-400 text-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl">
            <div className="text-center">
              <span className="inline-block bg-amber-400 text-slate-950 font-black px-4 py-1 rounded-full text-sm sm:text-base uppercase mb-2">
                ⚡ DESEMPATE OFICIAL EN VIVO ⚡
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white">
                ¡SORTEO AL NÚMERO MAYOR!
              </h2>
              <p className="text-slate-300 text-base sm:text-lg mt-1">
                Tabla #{activeTieBreak.tableIndex} ({activeTieBreak.stage}) •
                Premio:{" "}
                <strong className="text-amber-300">
                  {activeTieBreak.prizeName}
                </strong>
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {activeTieBreak.candidates.map((cand) => {
                const isWinner =
                  activeTieBreak.winnerCardNumber === cand.cardNumber;
                const isMe = myCardNumbersSet.has(cand.cardNumber);

                return (
                  <div
                    key={cand.cardNumber}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      isWinner
                        ? "bg-emerald-900/70 border-emerald-400 ring-4 ring-emerald-400/40"
                        : isMe
                        ? "bg-slate-800 border-amber-400"
                        : "bg-slate-800/70 border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg sm:text-xl text-white">
                          Cartón #{cand.cardNumber}
                        </span>
                        {isMe && (
                          <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full">
                            TU CARTÓN
                          </span>
                        )}
                        {isWinner && (
                          <span className="bg-emerald-400 text-slate-950 text-xs sm:text-sm font-black px-2.5 py-0.5 rounded-full">
                            🏆 ¡GANADOR!
                          </span>
                        )}
                      </div>
                      <p className="text-base sm:text-lg text-slate-200 font-bold">
                        {cand.buyerName}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {cand.drawnNumber !== null ? (
                        <div
                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex flex-col items-center justify-center font-black border-4 shadow-xl ${
                            isWinner
                              ? "bg-emerald-400 text-slate-950 border-white text-3xl sm:text-4xl scale-110"
                              : "bg-amber-400 text-slate-950 border-white text-2xl sm:text-3xl"
                          }`}
                        >
                          <span>{cand.drawnNumber}</span>
                        </div>
                      ) : (
                        <div className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 font-bold text-sm sm:text-base animate-pulse">
                          Esperando sacar bolilla...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {myPendingTieCandidates.map((cand) => (
              <div key={cand.cardNumber} className="mt-4">
                <button
                  type="button"
                  onClick={() => handleDrawTieBreakBall(cand.cardNumber)}
                  disabled={drawingTieBall}
                  className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-xl sm:text-2xl shadow-2xl hover:brightness-105 active:scale-98 transition-all border-4 border-white animate-bounce cursor-pointer"
                >
                  🎲 ¡SACAR MI NÚMERO MAYOR (CARTÓN #{cand.cardNumber})!
                </button>
              </div>
            ))}

            {activeTieBreak.winnerCardNumber && (
              <div className="mt-6 bg-emerald-500 text-slate-950 rounded-2xl p-4 text-center font-black">
                <div className="text-xl sm:text-2xl">
                  🎉 ¡GANADOR OFICIAL: {activeTieBreak.winnerName} (Cartón #
                  {activeTieBreak.winnerCardNumber})!
                </div>
                <div className="text-base sm:text-lg mt-1">
                  Ganó con la bolilla más alta:{" "}
                  <span className="underline text-2xl">
                    #{activeTieBreak.winningHighNumber}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CONTENIDO PRINCIPAL DEL CARTÓN                                        */}
      {/* ===================================================================== */}
      <main className="print-main max-w-6xl mx-auto px-3 pt-4 sm:px-6">
        {/* Barra superior de acciones rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 no-print">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setZoomedTable(null)}
              className={`px-4 py-2.5 rounded-xl font-black text-base sm:text-lg transition-all cursor-pointer ${
                zoomedTable === null
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white text-slate-900 border-2 border-slate-900 hover:bg-slate-100"
              }`}
            >
              📋{" "}
              {hasMultipleSheets
                ? `Ver mis ${playerCards.length} Tablas Completas`
                : "Ver mis 6 Tablas"}
            </button>

            <button
              type="button"
              onClick={() => setZoomedTable(gameState.activeTable)}
              className={`px-4 py-2.5 rounded-xl font-black text-base sm:text-lg transition-all cursor-pointer ${
                zoomedTable === gameState.activeTable
                  ? "bg-emerald-600 text-white shadow-md ring-4 ring-emerald-400/40"
                  : "bg-emerald-500 text-slate-950 border-2 border-slate-900 hover:bg-emerald-400"
              }`}
            >
              🎯{" "}
              {hasMultipleSheets
                ? `Abrir Juego #${gameState.activeTable} en mis ${playerCards.length} Tablas`
                : `Abrir Tabla #${gameState.activeTable} (En Juego)`}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setZoomedTable(null);
              setTimeout(() => window.print(), 150);
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base sm:text-lg border-2 border-slate-900 shadow-sm cursor-pointer"
          >
            🖨️ Descargar / Imprimir{" "}
            {hasMultipleSheets
              ? `mis ${playerCards.length} Tablas PDF`
              : "PDF con QR"}
          </button>
        </div>

        {/* =================================================================== */}
        {/* CUADRITOS DE ARRIBA (T#1..T#6):                                     */}
        {/* SOLO APARECEN SI EL CLIENTE TIENE VARIAS TABLAS COMPRADAS           */}
        {/* =================================================================== */}
        {hasMultipleSheets && (
          <div className="mb-5 bg-white border-2 border-slate-900 rounded-2xl p-3 sm:p-4 shadow-md no-print">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="text-sm sm:text-base font-black text-slate-900">
                🗂️ Tienes{" "}
                <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">
                  {playerCards.length} Tablas Compradas
                </span>{" "}
                ({playerCards.map((c) => `JUEGO #${c.cardNumber}`).join(", ")}
                ). Elige qué Juego quieres abrir en todas tus tablas a la vez:
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((tNum) => {
                const isCurrentZoom = zoomedTable === tNum;
                const isLiveTable = gameState.activeTable === tNum;
                const letterInfo = TABLE_LETTERS[tNum];

                return (
                  <button
                    key={tNum}
                    type="button"
                    onClick={() => {
                      setZoomedTable(tNum);
                      setClaimBanner(null);
                    }}
                    className={`py-2.5 px-3 rounded-xl font-black text-sm sm:text-base border-2 transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isCurrentZoom
                        ? "bg-slate-950 text-amber-300 border-slate-950 scale-[1.03] shadow-lg ring-2 ring-amber-400"
                        : isLiveTable
                        ? "bg-emerald-100 text-emerald-950 border-emerald-600 hover:bg-emerald-200"
                        : "bg-slate-50 text-slate-900 border-slate-300 hover:border-slate-900"
                    }`}
                  >
                    <span>
                      Abrir Juego #{tNum} {isLiveTable && "●"}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isCurrentZoom ? "text-white" : "text-slate-600"
                      }`}
                    >
                      ({letterInfo.title})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VISTA 1: MODO ENFOCADO EN UN JUEGO (T#1..T#6)                       */}
        {/* - Si tiene 1 sola tabla: se ve su único juego en grande.            */}
        {/* - Si tiene VARIAS tablas: se ven JUNTOS todos los Juego #X de cada  */}
        {/*   tabla que compró (como cuando los doblan en un tablero).          */}
        {/* =================================================================== */}
        {zoomedTable !== null && (
          <div className="no-print">
            {/* Cintillo de instrucción y pintado automático */}
            <div className="mb-4 bg-white border-2 border-slate-900 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs sm:text-sm font-extrabold uppercase text-emerald-700">
                  {hasMultipleSheets
                    ? `MODO TABLERO DOBLADO • VIENDO TUS ${playerCards.length} "TABLA #${zoomedTable}" JUNTAS`
                    : `JUEGO #${primaryCard.cardNumber} • ${primaryCard.buyerName}`}
                </div>
                <div className="text-lg sm:text-xl font-black text-slate-950">
                  {hasMultipleSheets
                    ? `Juego #${zoomedTable} (${TABLE_LETTERS[zoomedTable]?.title}) de tus ${playerCards.length} Tablas Compradas`
                    : `Toca los números en tu Tabla #${zoomedTable} para pintarlos`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAutoPaintGameAcrossAllSheets(zoomedTable)}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-900 font-black text-sm sm:text-base shadow-sm cursor-pointer"
              >
                ✨{" "}
                {hasMultipleSheets
                  ? `Pintar salidas en mis ${playerCards.length} Tablas #${zoomedTable}`
                  : "Pintar salidas automáticamente"}
              </button>
            </div>

            {claimBanner && (
              <div className="mb-4 bg-emerald-100 border-2 border-emerald-600 text-emerald-950 p-4 rounded-2xl font-black text-center text-base sm:text-lg">
                {claimBanner}
              </div>
            )}

            {/* Grilla con todas las TABLA #X de cada hoja que compró el cliente */}
            <div
              className={
                hasMultipleSheets
                  ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
                  : "max-w-lg mx-auto"
              }
            >
              {playerCards.map((sheetCard, sheetIdx) => {
                const tableObj = sheetCard.tables.find(
                  (t) => t.tableIndex === zoomedTable
                );
                if (!tableObj) return null;

                const markedList =
                  sheetCard.markedByTable[String(zoomedTable)] || [];
                const liveValidation = validateTablePattern(
                  tableObj.grid,
                  zoomedTable,
                  gameState.activeStage,
                  gameState.drawnBalls,
                  markedList
                );

                const sheetClaim: BingoClaim | undefined =
                  gameState.claims.find(
                    (c) =>
                      c.cardNumber === sheetCard.cardNumber &&
                      c.tableIndex === zoomedTable &&
                      c.stage === gameState.activeStage
                  );

                return (
                  <div
                    key={sheetCard.cardNumber}
                    className="bg-slate-200/70 border-2 border-slate-900 rounded-3xl p-3 sm:p-4 shadow-lg"
                  >
                    {/* Etiqueta superior identificando a cuál de sus hojas pertenece este juego */}
                    <div className="flex items-center justify-between mb-2 px-2">
                      <span className="bg-slate-950 text-amber-300 font-black text-sm sm:text-base px-3 py-1 rounded-xl">
                        {hasMultipleSheets
                          ? `HOJA ${sheetIdx + 1} DE ${
                              playerCards.length
                            } • CARTÓN #${sheetCard.cardNumber}`
                          : `CARTÓN JUEGO #${sheetCard.cardNumber}`}
                      </span>
                      <span className="font-mono font-bold text-xs sm:text-sm text-slate-700">
                        Serie: {tableObj.serialCode}
                      </span>
                    </div>

                    <BingoTableCard
                      tableIndex={tableObj.tableIndex}
                      serialCode={tableObj.serialCode}
                      grid={tableObj.grid}
                      markedNumbers={markedList}
                      drawnBalls={gameState.drawnBalls}
                      isActiveTable={gameState.activeTable === zoomedTable}
                      isZoomed={true}
                      winningCells={liveValidation.winningCells}
                      onToggleNumber={(num) =>
                        handleToggleNumber(
                          sheetCard.cardNumber,
                          zoomedTable,
                          num
                        )
                      }
                    />

                    {/* Botón de Enviar Verificación individual para este cartón */}
                    <div className="mt-3">
                      {sheetClaim ? (
                        <div
                          className={`p-3.5 rounded-2xl border-2 text-center ${
                            sheetClaim.status === "VALIDO"
                              ? "bg-emerald-600 text-white border-slate-950"
                              : sheetClaim.status === "RECHAZADO"
                              ? "bg-red-600 text-white border-slate-950"
                              : "bg-amber-400 text-slate-950 border-slate-950"
                          }`}
                        >
                          <div className="text-lg sm:text-xl font-black">
                            {sheetClaim.status === "VALIDO" &&
                              `✅ ¡CARTÓN #${sheetCard.cardNumber} VERIFICADO VÁLIDO!`}
                            {sheetClaim.status === "PENDIENTE" &&
                              `⏳ CARTÓN #${sheetCard.cardNumber} EN REVISIÓN...`}
                            {sheetClaim.status === "RECHAZADO" &&
                              `❌ AÚN NO COMPLETA LA FIGURA`}
                          </div>
                          <p className="text-xs sm:text-sm font-bold mt-0.5">
                            Reclamo {sheetClaim.id} •{" "}
                            {STAGES[sheetClaim.stage].shortLabel} (
                            {sheetClaim.validation.patternName})
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleSendClaim(sheetCard.cardNumber, zoomedTable)
                          }
                          disabled={submittingCardNum === sheetCard.cardNumber}
                          className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black text-xl sm:text-2xl shadow-xl border-4 border-slate-950 active:scale-98 transition-all cursor-pointer"
                        >
                          🎉 ¡BINGO! ENVIAR CARTÓN #{sheetCard.cardNumber}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="max-w-lg mx-auto mt-6">
              <button
                type="button"
                onClick={() => setZoomedTable(null)}
                className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-black text-lg hover:bg-slate-800 cursor-pointer"
              >
                ⬅{" "}
                {hasMultipleSheets
                  ? `Volver a ver mis ${playerCards.length} Hojas Completas (6 Tablas c/u)`
                  : "Volver a ver las 6 Tablas completas"}
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* VISTA 2: HOJA(S) COMPLETA(S) DE 6 JUEGOS CADA UNA                 */}
        {/* ================================================================= */}
        <div
          className={`space-y-8 ${
            zoomedTable !== null ? "hidden print:block" : "block"
          }`}
        >
          {playerCards.map((sheetCard, sheetIdx) => {
            const qrUrl = qrByCard[sheetCard.cardNumber];
            return (
              <div
                key={sheetCard.cardNumber}
                className="print-sheet bg-white border-4 border-slate-900 rounded-3xl p-4 sm:p-6 shadow-xl"
              >
                {hasMultipleSheets && (
                  <div className="no-print mb-3 flex items-center justify-between bg-slate-900 text-white px-4 py-2 rounded-2xl">
                    <span className="font-black text-base sm:text-lg text-amber-300">
                      📄 Hoja {sheetIdx + 1} de {playerCards.length} — JUEGO #
                      {sheetCard.cardNumber}
                    </span>
                    <span className="text-xs sm:text-sm text-slate-300 font-bold">
                      6 Juegos incluidos en esta hoja
                    </span>
                  </div>
                )}

                <div className="text-center mb-2 print:mb-1">
                  <h1 className="text-3xl sm:text-5xl print:text-2xl font-black tracking-wider text-slate-950 uppercase leading-none">
                    {gameState.event.title || "GRAN BINGO"}
                  </h1>
                </div>

                <div className="print-header-grid grid grid-cols-1 md:grid-cols-12 gap-3 mb-3 items-stretch">
                  <div className="md:col-span-9 border-2 border-slate-900 rounded-2xl p-3 print:p-2 text-sm sm:text-base print:text-xs space-y-1 bg-slate-50/60">
                    <div className="flex flex-wrap gap-2 border-b border-dotted border-slate-400 pb-0.5">
                      <span className="font-bold text-slate-700">
                        Organizado por:
                      </span>
                      <span className="font-black text-slate-950">
                        {gameState.event.organizedBy}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 border-b border-dotted border-slate-400 pb-0.5">
                      <span className="font-bold text-slate-700">
                        Dirección:
                      </span>
                      <span className="font-semibold text-slate-900">
                        {gameState.event.address}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 border-b border-dotted border-slate-400 pb-0.5">
                      <span className="font-bold text-slate-700">Nota:</span>
                      <span className="font-semibold text-slate-800">
                        {gameState.event.note}
                      </span>
                      <span className="text-emerald-800 font-black ml-auto">
                        Jugador(a): {sheetCard.buyerName}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="flex gap-1.5">
                        <span className="font-bold text-slate-700">
                          Fecha / hora:
                        </span>
                        <span className="font-bold text-slate-950">
                          {gameState.event.dateTimeText}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="font-bold text-slate-700">
                          Teléfonos:
                        </span>
                        <span className="font-bold text-slate-950">
                          {gameState.event.phones}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-3 border-2 border-slate-900 rounded-2xl p-2.5 print:p-1.5 flex flex-row items-center justify-around bg-amber-50/60 gap-2">
                    <div className="text-center">
                      <div className="text-[11px] font-extrabold uppercase text-slate-600">
                        Valor
                      </div>
                      <div className="text-2xl sm:text-3xl print:text-lg font-black text-slate-950 leading-tight">
                        {gameState.event.priceText}
                      </div>
                      <div className="text-[10px] font-mono font-bold text-slate-700">
                        JUEGO #{sheetCard.cardNumber}
                      </div>
                    </div>
                    {qrUrl && (
                      <img
                        src={qrUrl}
                        alt={`QR Cartón ${sheetCard.cardNumber}`}
                        className="w-20 h-20 print:w-14 print:h-14 rounded-lg border border-slate-900 bg-white p-0.5"
                      />
                    )}
                  </div>
                </div>

                <div className="text-center mb-2 print:mb-1">
                  <div className="inline-block bg-slate-950 text-white print:bg-transparent print:text-black font-black px-5 py-0.5 rounded-full text-lg sm:text-xl print:text-sm tracking-wide">
                    JUEGO #{sheetCard.cardNumber}
                  </div>
                  <p className="text-slate-700 font-bold text-sm sm:text-base mt-1 no-print">
                    👇{" "}
                    {hasMultipleSheets
                      ? "Toca cualquier tabla para abrir ese número de juego en todas tus hojas compradas:"
                      : "Dale clic a cualquiera de las 6 tablas para abrirla en grande y pintar tus números:"}
                  </p>
                </div>

                <div className="print-six-tables-grid grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  {sheetCard.tables.map((tableObj) => {
                    const markedList =
                      sheetCard.markedByTable[String(tableObj.tableIndex)] ||
                      [];
                    return (
                      <BingoTableCard
                        key={tableObj.tableIndex}
                        tableIndex={tableObj.tableIndex}
                        serialCode={tableObj.serialCode}
                        grid={tableObj.grid}
                        markedNumbers={markedList}
                        drawnBalls={gameState.drawnBalls}
                        isActiveTable={
                          gameState.activeTable === tableObj.tableIndex
                        }
                        isZoomed={false}
                        onSelectTable={() =>
                          setZoomedTable(tableObj.tableIndex)
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
