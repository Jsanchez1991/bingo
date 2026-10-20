"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import BingoTableCard from "@/components/BingoTableCard";
import type {
  BingoGameState,
  BingoClaim,
  EventMetadata,
  SaasOrganizer,
} from "@/lib/bingo-store";
import {
  STAGES,
  STAGE_ORDER,
  StageType,
  TABLE_LETTERS,
  formatBall,
  SaasPlanDefinition,
  SaasPlanId,
  parsePriceUsd,
} from "@/lib/bingo-patterns";
import {
  announceBallVoice,
  announceCustomVoice,
} from "@/lib/bingo-audio";
import {
  getSaasSession,
  setSaasSession,
  clearSaasSession,
  BingoSaasSession,
} from "@/lib/bingo-auth";

const DEFAULT_PRIZES_BY_TABLE_STAGE: Record<
  string,
  Partial<Record<StageType, string>>
> = {
  "1": {
    LINEA: "$10 en Efectivo",
    PUNTA: "$5 / Sorpresa",
    ESQUINAS: "$15 en Efectivo",
    BINGO_LOCO: "Pollo Hornado",
    LETRA: "Canasta de Víveres #1 (Letra B)",
    LLENA: "Canasta Familiar #1",
  },
  "2": {
    LINEA: "$10 en Efectivo",
    PUNTA: "$5 / Sorpresa",
    ESQUINAS: "$15 en Efectivo",
    BINGO_LOCO: "Premio Rápido $10",
    LETRA: "Canasta de Víveres #2 (Letra I)",
    LLENA: "Canasta Familiar #2",
  },
  "3": {
    LINEA: "$10 en Efectivo",
    PUNTA: "$5 / Sorpresa",
    ESQUINAS: "$15 en Efectivo",
    BINGO_LOCO: "Premio Rápido $10",
    LETRA: "Premio Sorpresa $30 (Letra N)",
    LLENA: "Premio Especial $40",
  },
  "4": {
    LINEA: "$15 en Efectivo",
    PUNTA: "$5 / Sorpresa",
    ESQUINAS: "$20 en Efectivo",
    BINGO_LOCO: "Premio Rápido $15",
    LETRA: "Electrodoméstico (Letra G)",
    LLENA: "Premio Especial $50",
  },
  "5": {
    LINEA: "$15 en Efectivo",
    PUNTA: "$10 en Efectivo",
    ESQUINAS: "$20 en Efectivo",
    BINGO_LOCO: "Premio Rápido $15",
    LETRA: "Premio Especial $50 (Letra O)",
    LLENA: "Premio Especial $80",
  },
  "6": {
    LINEA: "$25 en Efectivo",
    PUNTA: "$10 en Efectivo",
    ESQUINAS: "$30 en Efectivo",
    BINGO_LOCO: "$20 en Efectivo",
    LETRA: "Gran Premio Mayor $200 (Tabla Llena)",
    LLENA: "Gran Premio Mayor $200 (Tabla Llena)",
  },
};

interface EventSummaryOption {
  eventId: string;
  organizerId: string;
  organizerName: string;
  title: string;
  cardsCount: number;
}

export default function AdminOrganizerPage() {
  const [session, setSession] = useState<BingoSaasSession | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginCode, setLoginCode] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [gameState, setGameState] = useState<BingoGameState | null>(null);
  const [organizer, setOrganizer] = useState<SaasOrganizer | null>(null);
  const [plan, setPlan] = useState<SaasPlanDefinition | null>(null);
  const [eventsList, setEventsList] = useState<EventSummaryOption[]>([]);
  const [limitErrorMsg, setLimitErrorMsg] = useState<string | null>(null);

  // Modal rápido para crear un nuevo evento del organizador logueado
  const [showNewEventModal, setShowNewEventModal] = useState<boolean>(false);
  const [newEvtTitle, setNewEvtTitle] = useState<string>("");
  const [newEvtPrice, setNewEvtPrice] = useState<string>("$2.00");
  const [newEvtDate, setNewEvtDate] = useState<string>("Domingo 20h00");

  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [prizeInput, setPrizeInput] = useState<string>("");
  const [newBuyerName, setNewBuyerName] = useState<string>("");
  const [newBuyerPhone, setNewBuyerPhone] = useState<string>("");
  const [newBuyerQuantity, setNewBuyerQuantity] = useState<number>(1);
  const [selectedSellerId, setSelectedSellerId] = useState<string>("");
  const [manualTieBalls, setManualTieBalls] = useState<Record<string, string>>(
    {}
  );
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Estados para crear un nuevo Vendedor / Comisionista
  const [newSellerName, setNewSellerName] = useState<string>("");
  const [newSellerPhone, setNewSellerPhone] = useState<string>("");
  const [newSellerCommission, setNewSellerCommission] = useState<number>(10);

  // Estados para Talonario Pre-generado, Asignación por Vendedor y Enlace Temporal de Elección
  const [adminPoolSizeInput, setAdminPoolSizeInput] = useState<number>(100);
  const [assignFromNum, setAssignFromNum] = useState<number>(1);
  const [assignToNum, setAssignToNum] = useState<number>(50);
  const [assignSellerId, setAssignSellerId] = useState<string>("");
  const [selBuyerName, setSelBuyerName] = useState<string>("");
  const [selBuyerPhone, setSelBuyerPhone] = useState<string>("");
  const [selAllowedQty, setSelAllowedQty] = useState<number>(3);
  const [selSellerId, setSelSellerId] = useState<string>("");
  const [generatingPool, setGeneratingPool] = useState<boolean>(false);
  const [sellerStatusMsg, setSellerStatusMsg] = useState<string | null>(null);

  // Sincronizar el input de tamaño de talonario con el tope permitido por su plan
  useEffect(() => {
    if (plan?.maxCardsPerEvent) {
      setAdminPoolSizeInput((prev) => Math.min(prev, plan.maxCardsPerEvent));
    }
  }, [plan?.maxCardsPerEvent]);

  // Control de voz en cabina y detección de nuevos reclamos de BINGO
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const prevClaimsCountRef = useRef<number>(0);
  const isFirstFetchRef = useRef<boolean>(true);

  // Estado del formulario de Personalización del Cartón y Premios de las 6 Tablas
  const [showCustomizeForm, setShowCustomizeForm] = useState<boolean>(false);
  const [editingPrizeTableTab, setEditingPrizeTableTab] = useState<number>(1);
  const [eventForm, setEventForm] = useState<EventMetadata | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    const s = getSaasSession();
    setSession(s);
    setAuthChecked(true);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const currentSession = getSaasSession();
      const res = await fetch("/api/bingo", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      let newState: BingoGameState = data.state;
      const allEvents: EventSummaryOption[] = data.eventsList || [];

      // Si hay un organizador logueado y el evento activo no es suyo, cambiar automáticamente a su evento
      if (
        currentSession?.role === "ORGANIZER" &&
        currentSession.organizerId &&
        newState.organizerId !== currentSession.organizerId
      ) {
        const myEvent = allEvents.find(
          (ev) => ev.organizerId === currentSession.organizerId
        );
        if (myEvent) {
          const switchRes = await fetch("/api/bingo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "SWITCH_ACTIVE_EVENT",
              targetEventId: myEvent.eventId,
            }),
          });
          const switchData = await switchRes.json();
          if (switchData.state) {
            newState = switchData.state;
            if (switchData.organizer) setOrganizer(switchData.organizer);
            if (switchData.plan) setPlan(switchData.plan);
          }
        }
      } else {
        if (data.organizer) setOrganizer(data.organizer);
        if (data.plan) setPlan(data.plan);
      }

      if (!isFirstFetchRef.current) {
        if (newState.claims.length > prevClaimsCountRef.current) {
          const newestClaim = newState.claims[0];
          if (newestClaim) {
            announceCustomVoice(
              `¡Atención! ¡Bingo cantado en el Cartón número ${Number(
                newestClaim.cardNumber
              )} de ${newestClaim.buyerName}!`,
              soundEnabled
            );
          }
        }
      } else {
        isFirstFetchRef.current = false;
      }
      prevClaimsCountRef.current = newState.claims.length;

      setGameState(newState);
      setEventsList(allEvents);
      setPrizeInput(newState.currentPrizeName);
      setEventForm((prev) =>
        prev || {
          ...newState.event,
          prizesByTableStage:
            newState.event.prizesByTableStage || DEFAULT_PRIZES_BY_TABLE_STAGE,
        }
      );
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, [fetchState]);

  const postAction = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        eventId: payload.eventId || gameState?.eventId,
      }),
    });
    const data = await res.json();
    if (data.limitReached && data.message) {
      setLimitErrorMsg(data.message);
    } else if (data.ok) {
      setLimitErrorMsg(null);
    }
    if (data.state) {
      setGameState(data.state);
      setPrizeInput(data.state.currentPrizeName);
    }
    if (data.organizer) setOrganizer(data.organizer);
    if (data.plan) setPlan(data.plan);
    if (data.eventsList) setEventsList(data.eventsList);
    return data;
  };

  const handleQuickInlineLogin = async (
    identifier: string,
    accessCode: string
  ) => {
    setLoginError(null);
    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "LOGIN",
        role: "AUTO",
        identifier,
        accessCode,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setLoginError(data.message || "Credenciales incorrectas.");
      return;
    }
    if (data.session) {
      setSaasSession(data.session);
      setSession(data.session);
    }
    fetchState();
  };

  // Si no ha iniciado sesión como Organizador ni Super-Admin, mostrar pantalla de Login profesional
  if (
    authChecked &&
    (!session ||
      (session.role !== "ORGANIZER" && session.role !== "SUPERADMIN"))
  ) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border-4 border-amber-400 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div>
            <span className="inline-block bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-full text-xs uppercase">
              🔐 ACCESO A CABINA DE ORGANIZADOR
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mt-2">
              Iniciar Sesión
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Ingrese su correo o usuario y contraseña para acceder al panel de
              control de su evento.
            </p>
          </div>

          {loginError && (
            <div className="bg-red-950 border-2 border-red-500 text-red-200 p-3 rounded-xl font-bold text-xs sm:text-sm">
              ⚠️ {loginError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQuickInlineLogin(loginEmail, loginCode);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-black uppercase text-amber-300 mb-1">
                Usuario, Correo o Celular
              </label>
              <input
                type="text"
                required
                placeholder="Ingrese su usuario o correo"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-amber-300 mb-1">
                Contraseña / Clave de Acceso
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base shadow-lg cursor-pointer"
            >
              Ingresar al Panel ➔
            </button>
          </form>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs font-bold">
            <a href="/" className="text-slate-400 hover:text-white">
              ← Volver al Portal Principal
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-2xl font-black animate-pulse">
          Cargando Cabina del Organizador en Vivo...
        </div>
      </div>
    );
  }

  const drawnSet = new Set(gameState.drawnBalls);
  const lastBall =
    gameState.drawnBalls.length > 0
      ? gameState.drawnBalls[gameState.drawnBalls.length - 1]
      : null;

  const currentStageClaims = gameState.claims.filter(
    (c) =>
      c.tableIndex === gameState.activeTable &&
      c.stage === gameState.activeStage
  );
  const validCurrentClaims = currentStageClaims.filter(
    (c) => c.status === "VALIDO"
  );
  const pendingCurrentClaims = currentStageClaims.filter(
    (c) => c.status === "PENDIENTE"
  );

  const selectedClaim: BingoClaim | undefined =
    gameState.claims.find((c) => c.id === selectedClaimId) ||
    currentStageClaims[0] ||
    gameState.claims[0];

  // Control para evitar rebotes de clics rápidos en el bolillero
  const [togglingBall, setTogglingBall] = useState<number | null>(null);

  const handleToggleBallWithVoice = async (ballNum: number) => {
    if (togglingBall !== null) return; // Evita doble clic o conflicto de red
    setTogglingBall(ballNum);

    const wasAlreadyDrawn = drawnSet.has(ballNum);
    // Actualización optimista local inmediata para que la bolilla no parpadee ni se desmarque
    setGameState((prev) => {
      if (!prev) return prev;
      const nextDrawn = wasAlreadyDrawn
        ? prev.drawnBalls.filter((b) => b !== ballNum)
        : [...prev.drawnBalls, ballNum];
      return { ...prev, drawnBalls: nextDrawn };
    });

    if (!wasAlreadyDrawn) {
      announceBallVoice(ballNum, soundEnabled);
    }

    try {
      await postAction({ action: "TOGGLE_BALL", ballNumber: ballNum });
    } finally {
      setTogglingBall(null);
    }
  };

  const handleDrawRandomOfficialBall = async () => {
    if (togglingBall !== null) return;
    const remaining: number[] = [];
    for (let i = 1; i <= 75; i++) {
      if (!drawnSet.has(i)) remaining.push(i);
    }
    if (remaining.length === 0) return;
    const picked = remaining[Math.floor(Math.random() * remaining.length)];
    setTogglingBall(picked);

    setGameState((prev) => {
      if (!prev) return prev;
      return { ...prev, drawnBalls: [...prev.drawnBalls, picked] };
    });

    announceBallVoice(picked, soundEnabled);

    try {
      await postAction({ action: "TOGGLE_BALL", ballNumber: picked });
    } finally {
      setTogglingBall(null);
    }
  };

  const handleSaveEventCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm) return;
    await postAction({
      action: "UPDATE_EVENT_INFO",
      event: eventForm,
    });
    setSavedBanner(
      "✅ ¡Datos del cartón y premios de cada opción (Línea, Punta, Esquinas, Bingo Loco, Letra y Tabla Llena) guardados!"
    );
    setTimeout(() => setSavedBanner(null), 4000);
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyerName.trim()) return;
    const res = await postAction({
      action: "CREATE_CARD",
      buyerName: newBuyerName,
      buyerPhone: newBuyerPhone,
      quantity: newBuyerQuantity,
      sellerId: selectedSellerId || undefined,
    });
    if (res.ok) {
      setNewBuyerName("");
      setNewBuyerPhone("");
      setNewBuyerQuantity(1);
    }
  };

  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSellerName.trim()) return;
    const res = await postAction({
      action: "CREATE_SELLER",
      name: newSellerName,
      phone: newSellerPhone,
      commissionPercent: newSellerCommission,
    });
    if (res.ok) {
      const createdSeller = res.newSeller;
      if (createdSeller?.id) {
        setAssignSellerId(createdSeller.id);
        setSelSellerId(createdSeller.id);
      }
      setSellerStatusMsg(
        `✅ Vendedor "${newSellerName}" registrado. Ahora puedes asignarle sus tablas abajo.`
      );
      setTimeout(() => setSellerStatusMsg(null), 5000);
      setNewSellerName("");
      setNewSellerPhone("");
      setNewSellerCommission(10);
    }
  };

  const handleCreateNewOrganizerEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvtTitle.trim()) return;
    const res = await postAction({
      action: "CREATE_EVENT",
      organizerId: organizer?.id || session?.organizerId,
      title: newEvtTitle,
      priceText: newEvtPrice,
      dateTimeText: newEvtDate,
    });
    if (res.ok && res.state) {
      setShowNewEventModal(false);
      setNewEvtTitle("");
      setEventForm({
        ...res.state.event,
        prizesByTableStage:
          res.state.event.prizesByTableStage || DEFAULT_PRIZES_BY_TABLE_STAGE,
      });
    }
  };

  const getWhatsAppShareUrl = (
    cardNumbers: string[],
    secretToken: string,
    buyerName: string,
    buyerPhone: string
  ) => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    const cardUrl = `${origin}/jugar/${secretToken}`;
    const cardsLabel =
      cardNumbers.length === 1
        ? `tu Cartón Digital de 6 Juegos (*JUEGO #${cardNumbers[0]}*)`
        : `tus *${cardNumbers.length} Tablas Digitales* de 6 Juegos c/u (*JUEGOS ${cardNumbers
            .map((n) => `#${n}`)
            .join(", ")}*)`;
    const text = `🎉 *${gameState.event.title}* 🎉\nHola *${buyerName}*, aquí tienes ${cardsLabel}.\n\n👉 *Toca este enlace único para abrir tus tablas, pintar tus números y cantar BINGO en vivo:*\n${cardUrl}\n\n🔒 _Enlace personal para 1 solo teléfono. También puedes descargar tu PDF con QR desde el enlace._`;
    const cleanPhone = buyerPhone.replace(/\D/g, "");
    const ecPhone = cleanPhone.startsWith("0")
      ? `593${cleanPhone.slice(1)}`
      : cleanPhone;
    return ecPhone
      ? `https://wa.me/${ecPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const prizesMatrix =
    gameState.event.prizesByTableStage || DEFAULT_PRIZES_BY_TABLE_STAGE;
  const firstCardToken = gameState.cards[0]?.secretToken || "juego-00001";

  // Si es un Organizador normal, solo ve sus propios eventos; si es Super-Admin ve todos
  const visibleEvents =
    session?.role === "ORGANIZER" && session.organizerId
      ? eventsList.filter((ev) => ev.organizerId === session.organizerId)
      : eventsList;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* ===================================================================== */}
      {/* BARRA SUPERIOR DE CABINA DE TRANSMISIÓN EN VIVO + SESIÓN SAAS         */}
      {/* ===================================================================== */}
      <header className="bg-slate-900 border-b-4 border-amber-400 px-4 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-full animate-pulse">
                ● CABINA EN VIVO
              </span>
              {plan && (
                <span
                  className={`text-xs font-black px-3 py-1 rounded-full ${plan.badgeColor}`}
                >
                  💎 {plan.name}: {gameState.cards.length} /{" "}
                  {plan.maxCardsPerEvent} tablas usadas
                </span>
              )}
              {organizer && (
                <span className="text-slate-200 text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-full border border-slate-600">
                  👤 {organizer.name} ({organizer.organizationName})
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {gameState.event.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selector Rápido de Eventos del Organizador */}
            {visibleEvents.length > 0 && (
              <select
                value={gameState.eventId}
                onChange={async (e) => {
                  const nextId = e.target.value;
                  const data = await postAction({
                    action: "SWITCH_ACTIVE_EVENT",
                    targetEventId: nextId,
                  });
                  if (data.state) {
                    setEventForm({
                      ...data.state.event,
                      prizesByTableStage:
                        data.state.event.prizesByTableStage ||
                        DEFAULT_PRIZES_BY_TABLE_STAGE,
                    });
                  }
                }}
                className="bg-slate-950 border-2 border-sky-400 rounded-xl px-3 py-2 text-xs sm:text-sm font-black text-sky-300 cursor-pointer"
                title="Mis Eventos de Bingo"
              >
                {visibleEvents.map((ev) => (
                  <option key={ev.eventId} value={ev.eventId}>
                    📅 {ev.title} ({ev.cardsCount} tablas)
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setShowNewEventModal(!showNewEventModal)}
              className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
              title="Crear otro evento de Bingo en mi cuenta"
            >
              ➕ Nuevo Bingo
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-2 rounded-xl font-black text-xs sm:text-sm border-2 cursor-pointer transition-all ${
                soundEnabled
                  ? "bg-emerald-600 text-white border-emerald-300"
                  : "bg-slate-800 text-slate-400 border-slate-600"
              }`}
            >
              {soundEnabled ? "🔊 Voz: ON" : "🔇 Voz: OFF"}
            </button>

            <button
              type="button"
              onClick={() => setShowCustomizeForm(!showCustomizeForm)}
              className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow-md cursor-pointer"
            >
              🎨 Personalizar
            </button>

            <a
              href={`/jugar/${firstCardToken}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-md"
            >
              📱 Cartón ↗
            </a>

            {session?.role === "SUPERADMIN" && (
              <a
                href="/saas"
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm border border-purple-300"
              >
                👑 SaaS
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                clearSaasSession();
                window.location.href = "/login";
              }}
              className="px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-black text-xs sm:text-sm cursor-pointer"
              title="Cerrar sesión"
            >
              🚪 Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-8">
        {showNewEventModal && (
          <form
            onSubmit={handleCreateNewOrganizerEvent}
            className="bg-slate-900 border-4 border-sky-400 rounded-3xl p-5 flex flex-wrap items-end gap-3 shadow-2xl"
          >
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-black uppercase text-sky-300 mb-1">
                Título de tu Nuevo Evento de Bingo
              </label>
              <input
                type="text"
                required
                placeholder="Ej. GRAN BINGO SÁBADO FAMILIAR"
                value={newEvtTitle}
                onChange={(e) => setNewEvtTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                Fecha y Hora
              </label>
              <input
                type="text"
                value={newEvtDate}
                onChange={(e) => setNewEvtDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                Valor Tabla
              </label>
              <input
                type="text"
                value={newEvtPrice}
                onChange={(e) => setNewEvtPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-amber-300"
              />
            </div>
            <button
              type="submit"
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-sm cursor-pointer"
            >
              🚀 Crear Evento
            </button>
            <button
              type="button"
              onClick={() => setShowNewEventModal(false)}
              className="text-slate-400 hover:text-white font-bold text-xs px-3 py-2.5 cursor-pointer"
            >
              Cancelar
            </button>
          </form>
        )}
        {limitErrorMsg && (
          <div className="bg-red-950 border-2 border-amber-400 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
            <div className="text-amber-200 font-black text-sm sm:text-base">
              ⚠️ {limitErrorMsg}
            </div>
            {organizer && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    postAction({
                      action: "UPDATE_ORGANIZER_PLAN",
                      organizerId: organizer.id,
                      planId: "PLAN_PRO" as SaasPlanId,
                    })
                  }
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-4 py-2 rounded-xl text-xs sm:text-sm cursor-pointer"
                >
                  ⚡ Subir a Plan Pro ($35 — 1,000 tablas)
                </button>
                <a
                  href="/saas"
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-2 rounded-xl text-xs"
                >
                  Ver Planes SaaS
                </a>
              </div>
            )}
          </div>
        )}
        {/* =================================================================== */}
        {/* PANEL DESPLEGABLE: PERSONALIZACIÓN DEL CARTÓN Y PREMIOS POR OPCIÓN  */}
        {/* =================================================================== */}
        {showCustomizeForm && eventForm && (
          <section className="bg-slate-900 border-4 border-amber-400 rounded-3xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-amber-400">
                  🎨 Personalizar Cartón y Premios por Opción (Línea, Punta, 4
                  Esquinas, Bingo Loco, Letra y Tabla Llena)
                </h2>
                <p className="text-slate-300 text-sm sm:text-base">
                  Cada una de las 6 tablas puede tener sus propios premios para{" "}
                  <strong>
                    Línea, Punta, 4 Esquinas, Bingo Loco, Letra o Tabla Llena
                  </strong>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomizeForm(false)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>

            <form onSubmit={handleSaveEventCustomization} className="space-y-5">
              {/* Datos del Encabezado del Cartón */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1">
                    Título Principal del Cartón
                  </label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, title: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1">
                    Organizado por
                  </label>
                  <input
                    type="text"
                    value={eventForm.organizedBy}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        organizedBy: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1">
                    Valor del Cartón (Precio)
                  </label>
                  <input
                    type="text"
                    value={eventForm.priceText}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, priceText: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-amber-300 font-black text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1">
                    Dirección / Lugar de Transmisión
                  </label>
                  <input
                    type="text"
                    value={eventForm.address}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, address: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1">
                    Fecha y Hora del Bingo
                  </label>
                  <input
                    type="text"
                    value={eventForm.dateTimeText}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        dateTimeText: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1">
                    Teléfonos de Contacto
                  </label>
                  <input
                    type="text"
                    value={eventForm.phones}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, phones: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold text-base"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1">
                    Nota / Regla impresa en el Cartón
                  </label>
                  <input
                    type="text"
                    value={eventForm.note}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, note: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold text-base"
                  />
                </div>
              </div>

              {/* Premios por cada Tabla (1 a 6) y cada Sub-Juego (Línea, Punta, 4 Esquinas, Bingo Loco, Letra, Tabla Llena) */}
              <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-emerald-400">
                      🏆 Premios por Opción dentro de cada una de las 6 Tablas
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Elige una tabla abajo para configurar qué premio da en{" "}
                      <strong>
                        Línea, Punta, 4 Esquinas, Bingo Loco, Letra o Tabla
                        Llena
                      </strong>
                      :
                    </p>
                  </div>
                </div>

                {/* Pestañas para elegir cuál de las 6 tablas configurar */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((tIdx) => {
                    const info = TABLE_LETTERS[tIdx];
                    const isSelectedTab = editingPrizeTableTab === tIdx;
                    return (
                      <button
                        key={tIdx}
                        type="button"
                        onClick={() => setEditingPrizeTableTab(tIdx)}
                        className={`py-2.5 px-3 rounded-xl font-black text-sm border-2 transition-all cursor-pointer ${
                          isSelectedTab
                            ? "bg-amber-400 text-slate-950 border-white shadow-md"
                            : "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
                        }`}
                      >
                        TABLA #{tIdx} ({info.title})
                      </button>
                    );
                  })}
                </div>

                {/* Campos de premio para las 6 opciones de la tabla seleccionada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {STAGE_ORDER.map((stKey) => {
                    const st = STAGES[stKey];
                    const tKey = String(editingPrizeTableTab);
                    const currentVal =
                      eventForm.prizesByTableStage?.[tKey]?.[stKey] || "";

                    return (
                      <div
                        key={stKey}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-3"
                      >
                        <label className="block text-xs font-extrabold text-amber-300 mb-1">
                          {st.icon} Premio para {st.shortLabel} (Tabla #
                          {editingPrizeTableTab})
                        </label>
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) => {
                            const prevMatrix =
                              eventForm.prizesByTableStage ||
                              DEFAULT_PRIZES_BY_TABLE_STAGE;
                            setEventForm({
                              ...eventForm,
                              prizesByTableStage: {
                                ...prevMatrix,
                                [tKey]: {
                                  ...(prevMatrix[tKey] || {}),
                                  [stKey]: e.target.value,
                                },
                              },
                            });
                          }}
                          placeholder={`Ej. Premio ${st.shortLabel}`}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm"
                        />
                        <span className="block text-[11px] text-slate-400 mt-1">
                          {st.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {savedBanner ? (
                  <span className="text-emerald-400 font-black text-base">
                    {savedBanner}
                  </span>
                ) : (
                  <span className="text-slate-400 text-sm">
                    Cuando cambies entre Línea, Punta, 4 Esquinas, Bingo Loco,
                    Letra o Tabla Llena durante el juego, el premio se pondrá
                    automáticamente.
                  </span>
                )}

                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base sm:text-lg shadow-xl cursor-pointer"
                >
                  💾 Guardar Personalización y Premios
                </button>
              </div>
            </form>
          </section>
        )}

        {/* =================================================================== */}
        {/* PASO 1: SELECTOR EN ORDEN DE LAS 6 TABLAS Y OPCIONES DE SUB-JUEGO   */}
        {/* =================================================================== */}
        <section className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 sm:p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-amber-400">
                1. Orden de Juegos (Tabla #1 a #6) y Opciones en la misma tabla
              </h2>
              <p className="text-slate-300 text-sm sm:text-base">
                Dentro de la misma tabla puedes jugar{" "}
                <strong>
                  Línea, Punta, 4 Esquinas, Bingo Loco, Letra o Tabla Llena
                </strong>{" "}
                conservando las bolillas que ya salieron.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={prizeInput}
                onChange={(e) => setPrizeInput(e.target.value)}
                placeholder="Premio de esta jugada"
                className="bg-slate-950 border-2 border-slate-600 rounded-xl px-3.5 py-2 text-white font-bold text-base w-64"
              />
              <button
                type="button"
                onClick={() =>
                  postAction({
                    action: "UPDATE_EVENT_INFO",
                    currentPrizeName: prizeInput,
                  })
                }
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-4 py-2 rounded-xl text-base cursor-pointer"
              >
                Actualizar Premio
              </button>
            </div>
          </div>

          {/* Las 6 Tablas en orden (B - I - N - G - O - Llena) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
            {[1, 2, 3, 4, 5, 6].map((tIdx) => {
              const isCurrent = gameState.activeTable === tIdx;
              const info = TABLE_LETTERS[tIdx];
              const mainTablePrize =
                prizesMatrix[String(tIdx)]?.[
                  tIdx === 6 ? "LLENA" : "LETRA"
                ] || `Premio Tabla #${tIdx}`;

              return (
                <button
                  key={tIdx}
                  type="button"
                  onClick={() => {
                    if (tIdx === gameState.activeTable) return;
                    const confirmReset = window.confirm(
                      `¿Pasar a la TABLA #${tIdx} (${info.title}) y reiniciar las 75 bolillas para empezar el nuevo juego?`
                    );
                    if (confirmReset) {
                      postAction({
                        action: "CHANGE_TABLE",
                        tableIndex: tIdx,
                        resetBalls: true,
                      });
                    }
                  }}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-emerald-600 border-white text-white shadow-lg scale-[1.02]"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                  }`}
                >
                  <div className="text-xs font-extrabold uppercase opacity-80">
                    Juego {tIdx} de 6
                  </div>
                  <div className="text-xl font-black">TABLA #{tIdx}</div>
                  <div className="text-sm font-bold text-amber-300">
                    {info.title}
                  </div>
                  <div className="text-[11px] truncate mt-1 opacity-90">
                    🎁 {mainTablePrize}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Opciones de Sub-Juego dentro de la misma Tabla Activa (Línea, Punta, 4 Esquinas, Bingo Loco, Letra, Tabla Llena) */}
          <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-4">
            <div className="text-sm sm:text-base font-extrabold text-slate-300 mb-3 flex flex-wrap items-center justify-between gap-2">
              <span>
                🎯{" "}
                <strong className="text-white">
                  Opciones de Juego dentro de la TABLA #{gameState.activeTable}:
                </strong>{" "}
                (Al cambiar de opción NO se borran las bolillas salidas ni las
                marcas de los jugadores)
              </span>
              <span className="text-emerald-400 font-black">
                Jugando ahora: {STAGES[gameState.activeStage].label} —{" "}
                {gameState.currentPrizeName}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {STAGE_ORDER.map((stKey) => {
                const st = STAGES[stKey];
                const active = gameState.activeStage === stKey;
                const configuredPrizeForOption =
                  prizesMatrix[String(gameState.activeTable)]?.[stKey] ||
                  "Premio por definir";

                return (
                  <button
                    key={stKey}
                    type="button"
                    onClick={() =>
                      postAction({
                        action: "SET_STAGE",
                        stage: stKey,
                      })
                    }
                    className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      active
                        ? "bg-amber-400 text-slate-950 border-white font-black shadow-md"
                        : "bg-slate-900 text-white border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base sm:text-lg font-black">
                          {st.icon} {st.shortLabel}
                        </span>
                        {active && (
                          <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                            ACTIVA
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${
                          active
                            ? "text-slate-900 font-semibold"
                            : "text-slate-400"
                        }`}
                      >
                        {st.description}
                      </div>
                    </div>

                    <div
                      className={`mt-2 pt-1.5 border-t text-xs font-extrabold flex items-center justify-between ${
                        active
                          ? "border-slate-950/20 text-slate-950"
                          : "border-slate-800 text-emerald-400"
                      }`}
                    >
                      <span>🎁 Premio: {configuredPrizeForOption}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* PASO 2: TABLERO DE 75 BOLILLAS + COLA DE VERIFICACIÓN Y DESEMPATE   */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  2. Bolillero Oficial en Vivo (1 al 75) con Voz
                </h2>
                <p className="text-slate-300 text-sm sm:text-base">
                  Saca la bolilla de la funda frente a la cámara y{" "}
                  <strong className="text-amber-300">
                    toca el número aquí
                  </strong>{" "}
                  para cantarla con voz en todos los teléfonos.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div
                  onClick={() => {
                    if (lastBall) announceBallVoice(lastBall, true);
                  }}
                  title="Clic para repetir el canto de la última bolilla"
                  className="bg-slate-950 border-2 border-amber-400 rounded-2xl px-4 py-2 text-center cursor-pointer hover:bg-slate-900"
                >
                  <div className="text-xs text-slate-400 font-bold uppercase">
                    🔊 Última Cantada
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400">
                    {lastBall ? formatBall(lastBall) : "--"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDrawRandomOfficialBall}
                  className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-black text-amber-300 cursor-pointer"
                >
                  🎲 Sacar al Azar
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { letter: "B", min: 1, max: 15, color: "bg-blue-600" },
                { letter: "I", min: 16, max: 30, color: "bg-rose-600" },
                { letter: "N", min: 31, max: 45, color: "bg-emerald-600" },
                {
                  letter: "G",
                  min: 46,
                  max: 60,
                  color: "bg-amber-500 text-slate-950",
                },
                { letter: "O", min: 61, max: 75, color: "bg-purple-600" },
              ].map((rowGroup) => {
                const nums: number[] = [];
                for (let n = rowGroup.min; n <= rowGroup.max; n++) nums.push(n);
                return (
                  <div
                    key={rowGroup.letter}
                    className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800"
                  >
                    <div
                      className={`w-10 h-12 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-2xl shrink-0 ${rowGroup.color}`}
                    >
                      {rowGroup.letter}
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-15 gap-1.5 flex-1">
                      {nums.map((n) => {
                        const isOut = drawnSet.has(n);
                        const isLast = lastBall === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleToggleBallWithVoice(n)}
                            className={`h-10 sm:h-11 rounded-xl font-black text-base sm:text-lg transition-all cursor-pointer flex items-center justify-center border ${
                              isLast
                                ? "bg-amber-400 text-slate-950 border-white ring-2 ring-amber-300 scale-105"
                                : isOut
                                ? "bg-emerald-500 text-slate-950 border-emerald-300 shadow"
                                : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600"
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="text-slate-300 font-bold">
                Bolillas cantadas en Tabla #{gameState.activeTable}:{" "}
                <strong className="text-white">
                  {gameState.drawnBalls.length} de 75
                </strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Deseas limpiar todas las bolillas cantadas de esta tabla?"
                    )
                  ) {
                    postAction({
                      action: "CHANGE_TABLE",
                      tableIndex: gameState.activeTable,
                      stage: gameState.activeStage,
                      resetBalls: true,
                    });
                  }
                }}
                className="text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
              >
                Reiniciar bolillero a cero
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-amber-400">
                    3. Verificación y Desempate
                  </h2>
                  <p className="text-slate-300 text-sm">
                    Reclamos recibidos para{" "}
                    <strong>
                      Tabla #{gameState.activeTable} (
                      {STAGES[gameState.activeStage].shortLabel})
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => postAction({ action: "SIMULATE_TIE_DEMO" })}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm shadow cursor-pointer"
                >
                  🧪 Simular 3 Ganadores Empatados
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center">
                  <div className="text-2xl font-black text-white">
                    {currentStageClaims.length}
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    Reclamos Etapa
                  </div>
                </div>
                <div className="bg-emerald-950/60 border border-emerald-700 rounded-2xl p-3 text-center">
                  <div className="text-2xl font-black text-emerald-400">
                    {validCurrentClaims.length}
                  </div>
                  <div className="text-xs font-bold text-emerald-300">
                    Válidos Oficiales
                  </div>
                </div>
                <div className="bg-amber-950/60 border border-amber-700 rounded-2xl p-3 text-center">
                  <div className="text-2xl font-black text-amber-400">
                    {pendingCurrentClaims.length}
                  </div>
                  <div className="text-xs font-bold text-amber-300">
                    Por Revisar
                  </div>
                </div>
              </div>

              {validCurrentClaims.length >= 2 && (
                <div className="mb-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-400 rounded-2xl p-4">
                  <div className="text-base font-black text-amber-300 mb-1">
                    ⚡ ¡HAY {validCurrentClaims.length} GANADORES VÁLIDOS AL
                    MISMO TIEMPO!
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 mb-3">
                    Todos cumplieron la figura oficial. Lanza el{" "}
                    <strong>Sorteo Al Número Mayor</strong> para que cada uno
                    saque su bolilla y el número más alto gane el premio.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      postAction({ action: "START_TIE_BREAK" });
                      announceCustomVoice(
                        "¡Atención! Iniciamos el sorteo de desempate al número mayor.",
                        soundEnabled
                      );
                    }}
                    className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base sm:text-lg shadow-lg cursor-pointer"
                  >
                    🎲 INICIAR SORTEO &ldquo;AL NÚMERO MAYOR&rdquo; (
                    {validCurrentClaims.length} EMPATADOS)
                  </button>
                </div>
              )}

              {gameState.tieBreak && gameState.tieBreak.active && (
                <div className="mb-4 bg-slate-950 border-2 border-emerald-400 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-emerald-400 text-base">
                      🎲 DESEMPATE EN VIVO ACTIVO
                    </span>
                    <button
                      type="button"
                      onClick={() => postAction({ action: "CLOSE_TIE_BREAK" })}
                      className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg font-bold text-slate-300 cursor-pointer"
                    >
                      Cerrar ventana
                    </button>
                  </div>
                  <p className="text-xs text-slate-300">
                    El jugador puede tocar su celular para sacar su bolilla, o
                    tú puedes sacarla en cámara y anotarla aquí:
                  </p>
                  <div className="space-y-2">
                    {gameState.tieBreak.candidates.map((cand) => (
                      <div
                        key={cand.cardNumber}
                        className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800"
                      >
                        <div>
                          <div className="font-black text-sm text-white">
                            Cartón #{cand.cardNumber} — {cand.buyerName}
                          </div>
                          {cand.drawnNumber !== null && (
                            <div className="text-xs text-amber-300 font-bold">
                              Sacó bolilla: #{cand.drawnNumber} ({cand.drawnBy})
                            </div>
                          )}
                        </div>

                        {cand.drawnNumber === null ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={75}
                              placeholder="1-75"
                              value={manualTieBalls[cand.cardNumber] || ""}
                              onChange={(e) =>
                                setManualTieBalls({
                                  ...manualTieBalls,
                                  [cand.cardNumber]: e.target.value,
                                })
                              }
                              className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-sm font-bold text-white"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                postAction({
                                  action: "DRAW_TIE_BREAK_BALL",
                                  cardNumber: cand.cardNumber,
                                  manualNumber: manualTieBalls[cand.cardNumber]
                                    ? Number(manualTieBalls[cand.cardNumber])
                                    : null,
                                  drawnBy: "ORGANIZADOR",
                                })
                              }
                              className="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                            >
                              Asignar / Azar
                            </button>
                          </div>
                        ) : (
                          <span className="w-10 h-10 rounded-full bg-emerald-400 text-slate-950 font-black text-lg flex items-center justify-center">
                            {cand.drawnNumber}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {currentStageClaims.length === 0 ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 font-semibold">
                    Aún no hay reclamos de BINGO en esta etapa. Cuando un
                    jugador pulse &ldquo;Enviar Verificación&rdquo;, sonará la
                    alerta y aparecerá aquí al instante.
                  </div>
                ) : (
                  currentStageClaims.map((cl) => {
                    const isSelected = selectedClaim?.id === cl.id;
                    return (
                      <div
                        key={cl.id}
                        onClick={() => setSelectedClaimId(cl.id)}
                        className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-slate-800 border-amber-400"
                            : "bg-slate-950 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base text-white">
                              Cartón #{cl.cardNumber} • Tabla #{cl.tableIndex}
                            </span>
                            <span
                              className={`text-xs font-black px-2 py-0.5 rounded-full ${
                                cl.status === "VALIDO"
                                  ? "bg-emerald-500 text-slate-950"
                                  : cl.status === "RECHAZADO"
                                  ? "bg-red-600 text-white"
                                  : "bg-amber-400 text-slate-950"
                              }`}
                            >
                              {cl.status}
                            </span>
                          </div>
                          <div className="text-sm text-slate-300 font-bold">
                            {cl.buyerName} — {cl.validation.patternName}
                          </div>
                        </div>

                        {cl.status === "VALIDO" &&
                          validCurrentClaims.length === 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                postAction({
                                  action: "CONFIRM_DIRECT_WINNER",
                                  claimId: cl.id,
                                });
                                announceCustomVoice(
                                  `¡Felicidades! Ganador confirmado: ${cl.buyerName} con el Cartón número ${Number(
                                    cl.cardNumber
                                  )}`,
                                  soundEnabled
                                );
                              }}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3 py-2 rounded-xl shadow cursor-pointer"
                            >
                              🏆 Declarar Ganador Único
                            </button>
                          )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {selectedClaim && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs font-extrabold uppercase text-amber-400">
                      INSPECCIÓN DE CARTÓN ENVIADO ({selectedClaim.id})
                    </span>
                    <h3 className="text-base font-black text-white">
                      {selectedClaim.buyerName} — Cartón #
                      {selectedClaim.cardNumber} (Tabla #
                      {selectedClaim.tableIndex})
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        postAction({
                          action: "UPDATE_CLAIM_STATUS",
                          claimId: selectedClaim.id,
                          status: "VALIDO",
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        postAction({
                          action: "UPDATE_CLAIM_STATUS",
                          claimId: selectedClaim.id,
                          status: "RECHAZADO",
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                    >
                      ❌ Rechazar
                    </button>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-xl text-xs sm:text-sm font-bold mb-3 ${
                    selectedClaim.validation.isValidOfficial
                      ? "bg-emerald-950 border border-emerald-500 text-emerald-300"
                      : "bg-red-950 border border-red-500 text-red-300"
                  }`}
                >
                  {selectedClaim.validation.isValidOfficial ? (
                    <span>
                      ✅ SISTEMA CONFIRMA: Cumple{" "}
                      <strong>{selectedClaim.validation.patternName}</strong>{" "}
                      con las bolillas oficiales cantadas.
                    </span>
                  ) : (
                    <span>
                      ⚠️ INCOMPLETO: Aún no han salido en el bolillero los
                      números:{" "}
                      {selectedClaim.validation.missingOfficialNumbers.join(
                        ", "
                      )}
                    </span>
                  )}
                </div>

                <div className="text-slate-950">
                  <BingoTableCard
                    tableIndex={selectedClaim.tableIndex}
                    serialCode={`${selectedClaim.cardNumber}-${selectedClaim.tableIndex}`}
                    grid={selectedClaim.gridSnapshot}
                    markedNumbers={selectedClaim.markedNumbers}
                    drawnBalls={gameState.drawnBalls}
                    isActiveTable={true}
                    isZoomed={false}
                    winningCells={selectedClaim.validation.winningCells}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* PASO 3.5: TALONARIO PRE-GENERADO, REPARTO A VENDEDORES Y LINK ELEGIR*/}
        {/* =================================================================== */}
        <section className="bg-slate-900 border-4 border-amber-400 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="inline-block bg-amber-400 text-slate-950 font-black px-3 py-0.5 rounded-full text-xs uppercase mb-1">
                🎟️ TALONARIO NUMERADO Y ENLACE TEMPORAL PARA QUE EL CLIENTE ELIJA SUS TABLAS
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Catálogo de Tablas Pre-Creadas, Asignación a Vendedores y Link de Elección
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm">
                Pre-genera las tablas numeradas de tu evento (ej. 100 tablas), repártelas por rangos a tus vendedores (ej. 50 y 50) y envía enlaces de 1 solo uso para que el cliente escoja sus números favoritos.
              </p>
            </div>

            {/* Botón rápido para habilitar / completar las tablas del talonario según su plan */}
            <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div>
                <div className="text-[10px] font-black uppercase text-amber-300">
                  Tamaño Talonario {plan ? `(Máx. ${plan.maxCardsPerEvent})` : ""}
                </div>
                <input
                  type="number"
                  min={1}
                  max={plan?.maxCardsPerEvent || 100}
                  value={adminPoolSizeInput}
                  onChange={(e) => {
                    const maxAllowed = plan?.maxCardsPerEvent || 100;
                    const val = Number(e.target.value);
                    if (val > maxAllowed) {
                      setAdminPoolSizeInput(maxAllowed);
                    } else {
                      setAdminPoolSizeInput(Math.max(1, val || 1));
                    }
                  }}
                  className="w-24 bg-slate-900 border border-amber-400 rounded-xl px-2.5 py-1.5 text-sm font-black text-amber-300 mt-0.5"
                />
              </div>
              <button
                type="button"
                disabled={generatingPool}
                onClick={async () => {
                  setGeneratingPool(true);
                  const maxAllowed = plan?.maxCardsPerEvent || 100;
                  const targetSize = Math.min(adminPoolSizeInput, maxAllowed);
                  await postAction({
                    action: "GENERATE_EVENT_POOL",
                    poolSize: targetSize,
                  });
                  setGeneratingPool(false);
                }}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-4 py-3 rounded-xl text-xs sm:text-sm cursor-pointer shadow-lg"
              >
                {generatingPool
                  ? "Generando Tablas..."
                  : `⚡ Generar / Completar ${Math.min(adminPoolSizeInput, plan?.maxCardsPerEvent || 100)} Tablas`}
              </button>
            </div>
          </div>

          {/* Resumen de estado del Talonario */}
          {(() => {
            const totalInPool = gameState.cards.length;
            const availableInPool = gameState.cards.filter(
              (c) => c.status === "DISPONIBLE"
            ).length;
            const soldInPool = totalInPool - availableInPool;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Sub-panel A: Repartir Talonario por Rangos a Vendedores */}
                <div className="lg:col-span-5 bg-slate-950 border-2 border-sky-500/60 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-sky-400">
                      📦 1. Repartir Tablas a Vendedores (Trazabilidad)
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      Total: {totalInPool} ({availableInPool} libres / {soldInPool} vendidas)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Si tienes 100 tablas y 2 vendedores, asígnale de la #1 a la #50 al Vendedor 1 y de la #51 a la #100 al Vendedor 2.
                  </p>

                  {sellerStatusMsg && (
                    <div className="bg-emerald-950 border border-emerald-500 text-emerald-300 px-3 py-2 rounded-xl text-xs font-black">
                      {sellerStatusMsg}
                    </div>
                  )}

                  {/* Creación rápida de vendedor aquí mismo para no tener que bajar a la Sección 5 */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                    <div className="text-[10px] font-black uppercase text-sky-300">
                      ➕ Agregar Vendedor Rápido a la Lista:
                    </div>
                    <form
                      onSubmit={handleCreateSeller}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-1.5"
                    >
                      <input
                        type="text"
                        required
                        placeholder="Nombre del vendedor(a)"
                        value={newSellerName}
                        onChange={(e) => setNewSellerName(e.target.value)}
                        className="sm:col-span-5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                      />
                      <input
                        type="text"
                        placeholder="WhatsApp (opcional)"
                        value={newSellerPhone}
                        onChange={(e) => setNewSellerPhone(e.target.value)}
                        className="sm:col-span-4 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                      />
                      <button
                        type="submit"
                        className="sm:col-span-3 bg-sky-500/20 hover:bg-sky-500 border border-sky-400 text-sky-300 hover:text-slate-950 font-black py-1.5 px-2 rounded-lg text-xs cursor-pointer transition-colors"
                      >
                        + Crear Vendedor
                      </button>
                    </form>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await postAction({
                        action: "ASSIGN_CARDS_TO_SELLER",
                        fromNumber: assignFromNum,
                        toNumber: assignToNum,
                        sellerId: assignSellerId,
                      });
                      if (res.ok) {
                        const targetSeller = (gameState.sellers || []).find(
                          (s) => s.id === assignSellerId
                        );
                        setSellerStatusMsg(
                          targetSeller
                            ? `✅ Se asignaron las tablas #${String(assignFromNum).padStart(5, "0")} a #${String(assignToNum).padStart(5, "0")} al vendedor ${targetSeller.name}.`
                            : `✅ Se liberaron las tablas #${String(assignFromNum).padStart(5, "0")} a #${String(assignToNum).padStart(5, "0")} a Caja General.`
                        );
                        setTimeout(() => setSellerStatusMsg(null), 5000);
                      }
                    }}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end pt-1"
                  >
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Desde Tabla #
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={plan?.maxCardsPerEvent || 1000}
                        value={assignFromNum}
                        onChange={(e) =>
                          setAssignFromNum(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-black text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Hasta Tabla #
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={plan?.maxCardsPerEvent || 1000}
                        value={assignToNum}
                        onChange={(e) =>
                          setAssignToNum(Math.max(1, Number(e.target.value) || 50))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-black text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase text-sky-300 mb-1">
                        Vendedor Responsable {(gameState.sellers || []).length > 0 ? `(${(gameState.sellers || []).length} registrados)` : "(Crea vendedores en Sección 5)"}
                      </label>
                      <select
                        value={assignSellerId}
                        onChange={(e) => setAssignSellerId(e.target.value)}
                        className="w-full bg-slate-900 border border-sky-400 rounded-xl px-2.5 py-2 text-xs font-bold text-sky-300 cursor-pointer"
                      >
                        <option value="">🔓 Libre en Caja General</option>
                        {(gameState.sellers || []).map((s) => (
                          <option key={s.id} value={s.id}>
                            💼 {s.name} ({s.commissionPercent}% com.)
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="col-span-2 sm:col-span-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-2 px-3 rounded-xl text-xs cursor-pointer"
                    >
                      📌 Asignar Tablas #{String(assignFromNum).padStart(5, "0")} a #{String(assignToNum).padStart(5, "0")}
                    </button>
                  </form>
                </div>

                {/* Sub-panel B: Crear Enlace Temporal para que el Cliente elija sus X Tablas */}
                <div className="lg:col-span-7 bg-slate-950 border-2 border-emerald-500/70 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-emerald-400">
                      🔗 2. Crear Enlace Rápido para que el Cliente Elija sus Tablas
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                      Se cierra solo al confirmar
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    El cliente verá todas las tablas disponibles (con los espacios ocupados de las ya vendidas) y solo podrá elegir la cantidad exacta que tú le autorices aquí.
                  </p>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!selBuyerName.trim()) return;
                      const res = await postAction({
                        action: "CREATE_SELECTION_LINK",
                        buyerName: selBuyerName,
                        buyerPhone: selBuyerPhone,
                        allowedQuantity: selAllowedQty,
                        sellerId: selSellerId || undefined,
                      });
                      if (res.ok) {
                        setSelBuyerName("");
                        setSelBuyerPhone("");
                      }
                    }}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end pt-1"
                  >
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Nombre del Cliente
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Pedro Salazar"
                        value={selBuyerName}
                        onChange={(e) => setSelBuyerName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        WhatsApp Cliente
                      </label>
                      <input
                        type="text"
                        placeholder="099..."
                        value={selBuyerPhone}
                        onChange={(e) => setSelBuyerPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-amber-300 mb-1">
                        Vale por Exactamente
                      </label>
                      <select
                        value={selAllowedQty}
                        onChange={(e) => setSelAllowedQty(Number(e.target.value))}
                        className="w-full bg-slate-900 border-2 border-amber-400 rounded-xl px-2.5 py-2 text-xs font-black text-amber-300 cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((q) => (
                          <option key={q} value={q}>
                            Elegir {q} {q === 1 ? "Tabla" : "Tablas"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Talonario / Vendedor
                      </label>
                      <select
                        value={selSellerId}
                        onChange={(e) => setSelSellerId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        <option value="">Caja General (Todas)</option>
                        {(gameState.sellers || []).map((s) => (
                          <option key={s.id} value={s.id}>
                            💼 Lote de {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="sm:col-span-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs sm:text-sm cursor-pointer shadow-lg"
                    >
                      🔗 Generar Link para que "{selBuyerName || "el cliente"}" Elija Exactamente {selAllowedQty} {selAllowedQty === 1 ? "Tabla" : "Tablas"}
                    </button>
                  </form>
                </div>
              </div>
            );
          })()}

          {/* Lista de Enlaces de Elección Creados (Activos y Completados) */}
          {(gameState.selectionLinks || []).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-xs font-black uppercase text-amber-300">
                📲 Enlaces de Selección de Tablas Enviados a Clientes ({(gameState.selectionLinks || []).length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(gameState.selectionLinks || []).map((lnk) => {
                  const choosePath = `/elegir/${lnk.code}`;
                  const origin =
                    typeof window !== "undefined"
                      ? window.location.origin
                      : "http://localhost:3000";
                  const fullChooseUrl = `${origin}${choosePath}`;
                  const waText = `🎟️ *${gameState.event.title}* 🎟️\nHola *${lnk.buyerName}*, entra a este enlace para ver las tablas disponibles y *elegir tus ${lnk.allowedQuantity} ${lnk.allowedQuantity === 1 ? "tabla favorita" : "tablas favoritas"}*:\n\n👉 ${fullChooseUrl}\n\n🔒 _Una vez que confirmes tus ${lnk.allowedQuantity} tablas, el enlace se cerrará y quedarán guardadas a tu nombre._`;
                  const cleanPhone = (lnk.buyerPhone || "").replace(/\D/g, "");
                  const ecPhone = cleanPhone.startsWith("0")
                    ? `593${cleanPhone.slice(1)}`
                    : cleanPhone;
                  const waShare = ecPhone
                    ? `https://wa.me/${ecPhone}?text=${encodeURIComponent(waText)}`
                    : `https://wa.me/?text=${encodeURIComponent(waText)}`;

                  return (
                    <div
                      key={lnk.id}
                      className={`rounded-2xl p-3.5 border-2 flex flex-col justify-between space-y-2.5 ${
                        lnk.status === "ACTIVO"
                          ? "bg-slate-950 border-amber-400"
                          : "bg-slate-950/60 border-emerald-600/60"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                              lnk.status === "ACTIVO"
                                ? "bg-amber-400 text-slate-950"
                                : "bg-emerald-500 text-slate-950"
                            }`}
                          >
                            {lnk.status === "ACTIVO"
                              ? `⏳ ESPERANDO QUE ELIJA (${lnk.allowedQuantity} TABLAS)`
                              : `✔ YA ELIGIÓ (${lnk.selectedCardNumbers.map((n) => `#${n}`).join(", ")})`}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              postAction({
                                action: "DELETE_SELECTION_LINK",
                                linkId: lnk.id,
                              })
                            }
                            className="text-red-400 hover:text-red-300 text-xs font-bold cursor-pointer"
                            title="Eliminar este enlace"
                          >
                            🗑️
                          </button>
                        </div>

                        <div className="text-base font-black text-white mt-1.5">
                          {lnk.buyerName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {choosePath}
                          {lnk.sellerName ? ` • 💼 ${lnk.sellerName}` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {lnk.status === "ACTIVO" ? (
                          <>
                            <a
                              href={waShare}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-2 px-2.5 rounded-xl text-center"
                            >
                              📲 Mandar por WhatsApp
                            </a>
                            <a
                              href={choosePath}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2 px-2.5 rounded-xl border border-slate-700"
                            >
                              Abrir ↗
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(fullChooseUrl);
                                setCopiedToken(lnk.code);
                                setTimeout(() => setCopiedToken(null), 2000);
                              }}
                              className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs py-2 px-2.5 rounded-xl border border-slate-700 cursor-pointer"
                            >
                              {copiedToken === lnk.code ? "✔" : "Copiar"}
                            </button>
                          </>
                        ) : (
                          <a
                            href={`/jugar/${lnk.finalPlayerToken}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-black text-xs py-2 px-3 rounded-xl text-center"
                          >
                            🎱 Ver Tablas Elegidas ({lnk.selectedCardNumbers.map((n) => `#${n}`).join(", ")}) ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* =================================================================== */}
        {/* PASO 4: GESTIÓN DE CARTONES, LINKS DE WHATSAPP Y CONTROL DE IP      */}
        {/* =================================================================== */}
        <section className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 sm:p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                4. Clientes, Tablas Vendidas (1 o Varias por Cliente), WhatsApp
                y Candado IP
              </h2>
              <p className="text-slate-300 text-sm sm:text-base">
                Un cliente puede comprar <strong>1, 2, 3 o más tablas</strong>{" "}
                (cada tabla trae sus 6 juegos) y todas quedan dentro de su{" "}
                <strong>mismo enlace único de WhatsApp</strong>.
              </p>
            </div>

            <form
              onSubmit={handleCreateCard}
              className="flex flex-wrap items-center gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800"
            >
              <input
                type="text"
                required
                placeholder="Nombre del comprador(a)"
                value={newBuyerName}
                onChange={(e) => setNewBuyerName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
              />
              <input
                type="text"
                placeholder="Celular WhatsApp (ej. 099...)"
                value={newBuyerPhone}
                onChange={(e) => setNewBuyerPhone(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white w-40"
              />
              <select
                value={newBuyerQuantity}
                onChange={(e) => setNewBuyerQuantity(Number(e.target.value))}
                className="bg-slate-900 border-2 border-amber-400 rounded-xl px-3 py-2 text-sm font-black text-amber-300 cursor-pointer"
                title="Cantidad de tablas (hojas de 6 juegos) que compra este cliente"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10].map((q) => (
                  <option key={q} value={q}>
                    {q} {q === 1 ? "Tabla (6 juegos)" : `Tablas (${q * 6} juegos)`}
                  </option>
                ))}
              </select>
              {(gameState.sellers || []).length > 0 && (
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-200 cursor-pointer"
                  title="Asignar venta a un vendedor o taquilla"
                >
                  <option value="">Venta Directa (Organizador)</option>
                  {(gameState.sellers || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      💼 {s.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 rounded-xl text-sm cursor-pointer"
              >
                ➕ Vender {newBuyerQuantity}{" "}
                {newBuyerQuantity === 1 ? "Tabla" : "Tablas"}
              </button>
            </form>
          </div>

          {/* Agrupamos los cartones por cliente (secretToken) */}
          {(() => {
            const clientGroups: {
              secretToken: string;
              buyerName: string;
              buyerPhone: string;
              cards: typeof gameState.cards;
            }[] = [];
            const mapByToken = new Map<
              string,
              (typeof clientGroups)[number]
            >();

            for (const c of gameState.cards) {
              if (c.status === "DISPONIBLE") continue;
              let grp = mapByToken.get(c.secretToken);
              if (!grp) {
                grp = {
                  secretToken: c.secretToken,
                  buyerName: c.buyerName,
                  buyerPhone: c.buyerPhone,
                  cards: [],
                };
                mapByToken.set(c.secretToken, grp);
                clientGroups.push(grp);
              }
              grp.cards.push(c);
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientGroups.map((grp) => {
                  const cardNumbers = grp.cards.map((c) => c.cardNumber);
                  const primaryLock = grp.cards[0]?.sessionLock;
                  const soldBySellerName = grp.cards[0]?.soldBySellerName;
                  const waUrl = getWhatsAppShareUrl(
                    cardNumbers,
                    grp.secretToken,
                    grp.buyerName,
                    grp.buyerPhone
                  );
                  const playerPath = `/jugar/${grp.secretToken}`;

                  return (
                    <div
                      key={grp.secretToken}
                      className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="bg-amber-400 text-slate-950 font-black px-3 py-0.5 rounded-full text-xs sm:text-sm">
                            {grp.cards.length === 1
                              ? `1 TABLA: JUEGO #${cardNumbers[0]}`
                              : `${grp.cards.length} TABLAS: ${cardNumbers
                                  .map((n) => `#${n}`)
                                  .join(", ")}`}
                          </span>
                          <span
                            className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                              primaryLock
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-600"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {primaryLock
                              ? `🔒 Conectado (IP: ${primaryLock.ipAddress})`
                              : "🟢 Libre (Esperando 1er ingreso)"}
                          </span>
                        </div>

                        <h3 className="text-lg font-black text-white mt-2">
                          {grp.buyerName}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono">
                          Tel: {grp.buyerPhone || "No registrado"} • Link:{" "}
                          {playerPath}
                        </p>
                        {soldBySellerName && (
                          <p className="text-xs text-sky-300 font-bold mt-1">
                            💼 Vendido por: {soldBySellerName}
                          </p>
                        )}
                        <p className="text-xs text-emerald-400 font-bold mt-1">
                          {grp.cards.length === 1
                            ? "Vista individual de 1 hoja (6 juegos)"
                            : `Modo Tablero Doblado activo (${grp.cards.length} hojas = ${
                                grp.cards.length * 6
                              } juegos)`}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex items-center gap-2">
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm py-2 px-3 rounded-xl text-center"
                          >
                            📲 Enviar por WhatsApp
                          </a>
                          <a
                            href={playerPath}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm py-2 px-3 rounded-xl border border-slate-700"
                          >
                            Abrir ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const fullUrl = `${window.location.origin}${playerPath}`;
                              navigator.clipboard.writeText(fullUrl);
                              setCopiedToken(grp.secretToken);
                              setTimeout(() => setCopiedToken(null), 2000);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs py-2 px-2.5 rounded-xl border border-slate-700 cursor-pointer"
                          >
                            {copiedToken === grp.secretToken ? "✔" : "Copiar"}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              postAction({
                                action: "CREATE_CARD",
                                existingSecretToken: grp.secretToken,
                                buyerName: grp.buyerName,
                                buyerPhone: grp.buyerPhone,
                                quantity: 1,
                              })
                            }
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-extrabold text-xs cursor-pointer"
                          >
                            ➕ Agregar +1 Tabla
                          </button>

                          {primaryLock && (
                            <button
                              type="button"
                              onClick={() =>
                                postAction({
                                  action: "UNLOCK_CARD_DEVICE",
                                  secretToken: grp.secretToken,
                                })
                              }
                              className="py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-bold text-xs cursor-pointer"
                            >
                              🔓 Liberar IP
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const ok = window.confirm(
                                `¿Eliminar a "${grp.buyerName}" y sus ${grp.cards.length} tabla(s) (${cardNumbers.map((n) => `#${n}`).join(", ")})?`
                              );
                              if (!ok) return;
                              postAction({
                                action: "DELETE_CARD_GROUP",
                                secretToken: grp.secretToken,
                              });
                            }}
                            className="py-1.5 px-2.5 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/60 text-red-300 hover:text-white font-black text-xs cursor-pointer transition-colors"
                            title="Eliminar este cliente y sus tablas"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>

        {/* =================================================================== */}
        {/* PASO 5: RED DE VENDEDORES / COMISIONISTAS Y CUADRE DE CAJA SAAS     */}
        {/* =================================================================== */}
        <section className="bg-slate-900 border-2 border-sky-500/70 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-block bg-sky-500 text-slate-950 font-black px-3 py-0.5 rounded-full text-xs uppercase mb-1">
                💼 MÓDULO SAAS DE VENDEDORES Y CUADRE DE CAJA
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                5. Vendedores / Comisionistas y Recaudación del Evento
              </h2>
              <p className="text-slate-300 text-sm">
                Crea enlaces exclusivos de Punto de Venta (
                <code>/vendedor/...</code>) para tu equipo. Ellos{" "}
                <strong>solo pueden vender tablas y enviar WhatsApp</strong>, no
                tocar el bolillero.
              </p>
            </div>

            <form
              onSubmit={handleCreateSeller}
              className="flex flex-wrap items-center gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800"
            >
              <input
                type="text"
                required
                placeholder="Nombre del Vendedor(a)"
                value={newSellerName}
                onChange={(e) => setNewSellerName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
              />
              <input
                type="text"
                placeholder="WhatsApp Vendedor"
                value={newSellerPhone}
                onChange={(e) => setNewSellerPhone(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white w-36"
              />
              <select
                value={newSellerCommission}
                onChange={(e) => setNewSellerCommission(Number(e.target.value))}
                className="bg-slate-900 border border-sky-400 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-black text-sky-300 cursor-pointer"
                title="Porcentaje de comisión para el vendedor"
              >
                {[0, 5, 10, 15, 20, 25].map((pct) => (
                  <option key={pct} value={pct}>
                    Comisión {pct}%
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-4 py-2 rounded-xl text-sm cursor-pointer"
              >
                ➕ Crear Acceso Vendedor
              </button>
            </form>
          </div>

          {(() => {
            const unitPrice = parsePriceUsd(gameState.event.priceText);
            const sellersList = gameState.sellers || [];
            const soldCardsList = gameState.cards.filter(
              (c) => c.status !== "DISPONIBLE"
            );
            const totalCards = soldCardsList.length;
            const totalGross = totalCards * unitPrice;

            let totalCommissions = 0;
            for (const s of sellersList) {
              const count = soldCardsList.filter(
                (c) => c.soldBySellerId === s.id
              ).length;
              totalCommissions +=
                count * unitPrice * ((s.commissionPercent || 0) / 100);
            }
            const netOrganizer = totalGross - totalCommissions;

            return (
              <>
                {/* Resumen Financiero del Evento */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
                    <div className="text-xs font-extrabold uppercase text-slate-400">
                      Total Tablas Vendidas
                    </div>
                    <div className="text-2xl font-black text-white mt-0.5">
                      {totalCards} tablas{" "}
                      <span className="text-xs text-slate-400">
                        ({gameState.event.priceText} c/u)
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
                    <div className="text-xs font-extrabold uppercase text-amber-400">
                      Recaudación Bruta Total
                    </div>
                    <div className="text-2xl font-black text-amber-300 mt-0.5">
                      ${totalGross.toFixed(2)} USD
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
                    <div className="text-xs font-extrabold uppercase text-sky-400">
                      Comisiones Vendedores
                    </div>
                    <div className="text-2xl font-black text-sky-300 mt-0.5">
                      -${totalCommissions.toFixed(2)} USD
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-emerald-500/60 rounded-2xl p-3.5">
                    <div className="text-xs font-extrabold uppercase text-emerald-400">
                      Caja Neta Organizador
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-0.5">
                      ${netOrganizer.toFixed(2)} USD
                    </div>
                  </div>
                </div>

                {/* Tarjetas de cada Vendedor */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sellersList.map((s) => {
                    const assignedCards = gameState.cards.filter(
                      (c) => c.assignedSellerId === s.id
                    );
                    const assignedAvailCount = assignedCards.filter(
                      (c) => c.status === "DISPONIBLE"
                    ).length;
                    const soldCount = soldCardsList.filter(
                      (c) => c.soldBySellerId === s.id
                    ).length;
                    const gross = soldCount * unitPrice;
                    const comm = gross * ((s.commissionPercent || 0) / 100);
                    const toDeliver = gross - comm;
                    const sellerPath = `/vendedor/${s.sellerCode}`;

                    const minAssignedNum =
                      assignedCards.length > 0
                        ? assignedCards[0].cardNumber
                        : null;
                    const maxAssignedNum =
                      assignedCards.length > 0
                        ? assignedCards[assignedCards.length - 1].cardNumber
                        : null;

                    return (
                      <div
                        key={s.id}
                        className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                s.active
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-600"
                                  : "bg-red-950 text-red-400 border border-red-600"
                              }`}
                            >
                              {s.active ? "● Caja Activa" : "● Pausado"}
                            </span>
                            <span className="text-xs font-black text-sky-300">
                              Comisión: {s.commissionPercent}%
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-white mt-2">
                            {s.name}
                          </h3>
                          <p className="text-xs text-slate-400 font-mono">
                            Link POS: {sellerPath}
                          </p>
                          <p className="text-xs font-bold text-amber-300 mt-1">
                            {assignedCards.length > 0
                              ? `📦 Talonario Asignado: ${assignedCards.length} tablas (#${minAssignedNum} a #${maxAssignedNum}) • Libres: ${assignedAvailCount}`
                              : "📦 Sin lote fijo (vende del talonario general)"}
                          </p>

                          <div className="mt-3 bg-slate-900 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center border border-slate-800">
                            <div>
                              <div className="text-[10px] font-bold uppercase text-slate-400">
                                Vendidas
                              </div>
                              <div className="text-sm font-black text-white">
                                {soldCount}
                                {assignedCards.length > 0
                                  ? ` / ${assignedCards.length}`
                                  : ""}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase text-slate-400">
                                Su Comisión
                              </div>
                              <div className="text-sm font-black text-sky-300">
                                ${comm.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase text-emerald-400">
                                Entrega a Caja
                              </div>
                              <div className="text-sm font-black text-emerald-400">
                                ${toDeliver.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <a
                            href={sellerPath}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs py-2 px-3 rounded-xl text-center"
                          >
                            💼 Abrir Caja Vendedor ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const fullUrl = `${window.location.origin}${sellerPath}`;
                              navigator.clipboard.writeText(fullUrl);
                              setCopiedToken(s.sellerCode);
                              setTimeout(() => setCopiedToken(null), 2000);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs py-2 px-2.5 rounded-xl border border-slate-700 cursor-pointer"
                          >
                            {copiedToken === s.sellerCode ? "✔" : "Copiar Link"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              postAction({
                                action: "TOGGLE_SELLER_STATUS",
                                sellerId: s.id,
                              })
                            }
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2 px-2.5 rounded-xl border border-slate-700 cursor-pointer"
                          >
                            {s.active ? "Pausar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const ok = window.confirm(
                                `¿Eliminar al vendedor "${s.name}"?`
                              );
                              if (!ok) return;
                              postAction({
                                action: "DELETE_SELLER",
                                sellerId: s.id,
                              });
                            }}
                            className="bg-red-600/20 hover:bg-red-600 border border-red-500/60 text-red-300 hover:text-white font-black text-xs py-2 px-2.5 rounded-xl cursor-pointer transition-colors"
                            title="Eliminar vendedor"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </section>

        {gameState.winnersHistory.length > 0 && (
          <section className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 sm:p-6 shadow-xl">
            <h2 className="text-xl font-black text-emerald-400 mb-3">
              🏆 Acta Oficial de Ganadores Confirmados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gameState.winnersHistory.map((w) => (
                <div
                  key={w.id}
                  className="bg-slate-950 border border-emerald-700/60 rounded-2xl p-3.5 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-extrabold text-emerald-400 uppercase">
                      Tabla #{w.tableIndex} • {STAGES[w.stage].shortLabel} —{" "}
                      {w.prizeName}
                    </div>
                    <div className="text-lg font-black text-white">
                      {w.buyerName} (Cartón #{w.cardNumber})
                    </div>
                    <div className="text-xs text-slate-400">
                      {w.patternName}
                    </div>
                  </div>
                  {w.wonViaTieBreak && (
                    <div className="bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-sm">
                      Bolilla Mayor #{w.highBallNumber}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
