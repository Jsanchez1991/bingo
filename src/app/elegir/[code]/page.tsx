"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import BingoTableCard from "@/components/BingoTableCard";
import type {
  BingoGameState,
  BingoCardSheet,
  SelectionLinkSession,
  SaasOrganizer,
} from "@/lib/bingo-store";

export default function ChooseCardsPage() {
  const params = useParams();
  const selectionCode = String(params?.code || "");

  const [gameState, setGameState] = useState<BingoGameState | null>(null);
  const [linkSession, setLinkSession] = useState<SelectionLinkSession | null>(
    null
  );
  const [organizer, setOrganizer] = useState<SaasOrganizer | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedCardNumbers, setSelectedCardNumbers] = useState<string[]>([]);
  const [buyerName, setBuyerName] = useState<string>("");
  const [buyerPhone, setBuyerPhone] = useState<string>("");
  const [previewCard, setPreviewCard] = useState<BingoCardSheet | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const fetchSelectionData = useCallback(async () => {
    if (!selectionCode) return;
    try {
      const res = await fetch(
        `/api/bingo?selectionCode=${encodeURIComponent(selectionCode)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setErrorMsg("Este enlace de elección no existe o ha sido eliminado.");
        return;
      }
      const data = await res.json();
      setGameState(data.state);
      setLinkSession(data.linkSession);
      setOrganizer(data.organizer);
      if (data.linkSession) {
        setBuyerName((prev) => prev || data.linkSession.buyerName || "");
        setBuyerPhone((prev) => prev || data.linkSession.buyerPhone || "");
      }
      setErrorMsg(null);
    } catch {
      setErrorMsg("Error de conexión con el servidor.");
    }
  }, [selectionCode]);

  useEffect(() => {
    fetchSelectionData();
    const interval = setInterval(fetchSelectionData, 3000);
    return () => clearInterval(interval);
  }, [fetchSelectionData]);

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border-4 border-red-500 rounded-3xl p-8 max-w-md space-y-4">
          <div className="text-4xl">🚫</div>
          <h1 className="text-2xl font-black text-red-400">{errorMsg}</h1>
          <p className="text-slate-300 text-sm">
            Solicita un nuevo enlace al organizador o vendedor del bingo.
          </p>
        </div>
      </div>
    );
  }

  if (!gameState || !linkSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-2xl font-black animate-pulse">
          Cargando Talonario de Tablas Disponibles...
        </div>
      </div>
    );
  }

  // Si el enlace ya fue utilizado y cerrado, mostrar confirmación y botón directo a sus tablas
  if (linkSession.status !== "ACTIVO") {
    const playerUrl = linkSession.finalPlayerToken
      ? `/jugar/${linkSession.finalPlayerToken}`
      : null;

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border-4 border-emerald-500 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500 text-slate-950 font-black text-3xl flex items-center justify-center mx-auto shadow-lg">
            ✔
          </div>
          <div>
            <span className="inline-block bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-black px-3 py-1 rounded-full text-xs uppercase">
              🔒 Enlace Cerrado • Selección Completada
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 text-white">
              ¡Tus Tablas ya quedaron Registradas!
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Comprador(a):{" "}
              <strong className="text-amber-300">
                {linkSession.buyerName}
              </strong>
            </p>
          </div>

          <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-black uppercase text-slate-400 mb-2">
              Tablas Elegidas ({linkSession.selectedCardNumbers.length} hojas ={" "}
              {linkSession.selectedCardNumbers.length * 6} juegos)
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {linkSession.selectedCardNumbers.map((num) => (
                <span
                  key={num}
                  className="bg-amber-400 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-sm shadow"
                >
                  TABLA #{num}
                </span>
              ))}
            </div>
          </div>

          {playerUrl && (
            <div className="space-y-2 pt-2">
              <a
                href={playerUrl}
                className="block w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base sm:text-lg shadow-xl"
              >
                🎱 Abrir mis Tablas para Jugar en Vivo ➔
              </a>
              <p className="text-xs text-slate-400">
                Guarda ese enlace de juego; desde ahí podrás pintar tus números
                y descargar tu PDF con código QR.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Filtrar catálogo: si el link pertenece a un vendedor que tiene lote asignado, mostrar ese lote;
  // caso contrario mostrar todas las tablas del talonario.
  const sellerHasAssignedPool =
    linkSession.sellerId &&
    gameState.cards.some((c) => c.assignedSellerId === linkSession.sellerId);

  const catalogCards = gameState.cards.filter((c) => {
    if (sellerHasAssignedPool) {
      return c.assignedSellerId === linkSession.sellerId;
    }
    return true;
  });

  const filteredCards = catalogCards.filter((c) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.trim().toLowerCase();
    if (c.cardNumber.toLowerCase().includes(q)) return true;
    // Permitir buscar también si contiene cierto número de la suerte
    const numQuery = parseInt(q, 10);
    if (!isNaN(numQuery) && numQuery >= 1 && numQuery <= 75) {
      return c.tables.some((t) =>
        t.grid.some((row) => row.includes(numQuery))
      );
    }
    return false;
  });

  const allowedQty = linkSession.allowedQuantity;

  const handleToggleSelectCard = (card: BingoCardSheet) => {
    const isSold = card.status !== "DISPONIBLE";
    if (isSold) return;

    setSubmitErr(null);
    setSelectedCardNumbers((prev) => {
      if (prev.includes(card.cardNumber)) {
        return prev.filter((n) => n !== card.cardNumber);
      }
      if (prev.length >= allowedQty) {
        if (allowedQty === 1) {
          return [card.cardNumber];
        }
        setSubmitErr(
          `Este enlace es válido para elegir exactamente ${allowedQty} tablas. Desmarca una si deseas cambiarla.`
        );
        return prev;
      }
      return [...prev, card.cardNumber];
    });
  };

  const handleConfirmSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCardNumbers.length !== allowedQty) {
      setSubmitErr(
        `Debes seleccionar exactamente ${allowedQty} ${
          allowedQty === 1 ? "tabla" : "tablas"
        } antes de confirmar.`
      );
      return;
    }
    if (!buyerName.trim()) {
      setSubmitErr("Por favor ingresa tu nombre completo.");
      return;
    }

    setSubmitting(true);
    setSubmitErr(null);
    try {
      const res = await fetch("/api/bingo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIRM_CARD_SELECTION",
          selectionCode,
          selectedCardNumbers,
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitErr(
          data.message || "No se pudo confirmar la selección de tablas."
        );
        // Refrescar por si alguna tabla fue tomada
        fetchSelectionData();
        setSubmitting(false);
        return;
      }

      setLinkSession(data.linkSession);
      setGameState(data.state);
      setSubmitting(false);
    } catch {
      setSubmitErr("Error de red al guardar tus tablas.");
      setSubmitting(false);
    }
  };

  const availableCount = catalogCards.filter(
    (c) => c.status === "DISPONIBLE"
  ).length;
  const soldCount = catalogCards.length - availableCount;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      {/* CABECERA FIJA CON CONTADOR DE SELECCIÓN */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b-4 border-amber-400 px-4 py-3.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-amber-400 text-slate-950 font-black px-3 py-0.5 rounded-full text-xs uppercase">
                🎟️ ELIGE TUS TABLAS DE LA SUERTE
              </span>
              {linkSession.sellerName && (
                <span className="bg-sky-500/20 border border-sky-400/50 text-sky-300 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  💼 Vendedor: {linkSession.sellerName}
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-white mt-0.5">
              {gameState.event.title}
            </h1>
            <p className="text-xs text-slate-300 font-semibold">
              Hola <strong className="text-amber-300">{buyerName || linkSession.buyerName}</strong> •
              Este enlace es válido para elegir{" "}
              <strong className="text-emerald-400">
                exactamente {allowedQty} {allowedQty === 1 ? "tabla" : "tablas"}
              </strong>{" "}
              (6 juegos cada una).
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-950 border-2 border-emerald-500 rounded-2xl px-4 py-2">
            <div className="text-right">
              <div className="text-[10px] font-black uppercase text-slate-400">
                Tu Selección Actual
              </div>
              <div className="text-base sm:text-xl font-black text-emerald-400">
                {selectedCardNumbers.length} / {allowedQty} elegidas
              </div>
            </div>
            {selectedCardNumbers.length > 0 && (
              <div className="flex flex-wrap gap-1 max-w-[180px]">
                {selectedCardNumbers.map((n) => (
                  <span
                    key={n}
                    className="bg-amber-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-lg"
                  >
                    #{n}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-6">
        {submitErr && (
          <div className="bg-red-950 border-2 border-red-500 text-red-200 px-4 py-3 rounded-2xl font-black text-sm">
            ⚠️ {submitErr}
          </div>
        )}

        {/* BARRA DE DATOS DEL CLIENTE Y FILTRO DE NÚMEROS */}
        <section className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-amber-300 mb-1">
                Tu Nombre Completo
              </label>
              <input
                type="text"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Nombre y Apellido"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                Tu WhatsApp / Celular
              </label>
              <input
                type="text"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="099..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-sky-300 mb-1">
                🔍 Buscar # de Tabla o Número (1-75)
              </label>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Ej. 00017 o tu número 25"
                className="w-full bg-slate-950 border border-sky-500/60 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>

            <div className="flex flex-col justify-center bg-slate-950 border border-slate-800 rounded-xl px-4 py-2">
              <div className="text-xs font-bold text-emerald-400">
                🟢 Disponibles: <strong>{availableCount}</strong> tablas
              </div>
              <div className="text-xs font-bold text-slate-500 mt-0.5">
                🔴 Ya vendidas / ocupadas: <strong>{soldCount}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* CUADRÍCULA DE TODAS LAS TABLAS DEL TALONARIO */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const isSold = card.status !== "DISPONIBLE";
            const isSelected = selectedCardNumbers.includes(card.cardNumber);

            // Si ya fue vendida a otro cliente, mostrar el espacio vacío / ocupado
            if (isSold) {
              return (
                <div
                  key={card.cardNumber}
                  className="bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-3xl p-5 flex flex-col items-center justify-center text-center min-h-[240px] opacity-60 select-none"
                >
                  <span className="bg-slate-800 text-slate-400 font-mono font-black text-xs px-3 py-1 rounded-full">
                    TABLA #{card.cardNumber}
                  </span>
                  <div className="text-2xl mt-2">🔒</div>
                  <div className="text-sm font-black text-slate-400 mt-1 uppercase">
                    Espacio Ocupado (Ya Vendida)
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Esta tabla ya fue elegida por otro participante.
                  </p>
                </div>
              );
            }

            // Vista de Tabla Disponible con todos sus números para que el jugador revise y elija
            const table6 =
              card.tables.find((t) => t.tableIndex === 6) || card.tables[0];

            return (
              <div
                key={card.cardNumber}
                onClick={() => handleToggleSelectCard(card)}
                className={`rounded-3xl p-4 border-4 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? "bg-emerald-950/60 border-emerald-400 ring-4 ring-emerald-400/30 shadow-2xl scale-[1.01]"
                    : "bg-slate-900 border-slate-800 hover:border-amber-400/70 shadow-lg"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`font-black text-sm px-3 py-1 rounded-full ${
                        isSelected
                          ? "bg-emerald-400 text-slate-950"
                          : "bg-amber-400 text-slate-950"
                      }`}
                    >
                      TABLA #{card.cardNumber}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewCard(card);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs px-2.5 py-1 rounded-xl border border-slate-700 cursor-pointer"
                      >
                        🔍 Ver los 6 Juegos
                      </button>
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                          isSelected
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {isSelected ? "✔ ELEGIDA" : "Disponible"}
                      </span>
                    </div>
                  </div>

                  {/* Mini vista de los números principales (Tabla Llena #6 + Resumen de los 6 juegos) */}
                  <div className="bg-white text-slate-950 rounded-2xl p-2.5 border-2 border-slate-950">
                    <div className="flex items-center justify-between text-[11px] font-black text-slate-700 mb-1 px-1">
                      <span>NÚMEROS DE ESTA HOJA (JUEGO PRINCIPAL)</span>
                      <span className="text-emerald-700">6 TABLAS INCLUIDAS</span>
                    </div>
                    <div className="grid grid-cols-5 text-center font-black text-xs bg-slate-900 text-amber-300 rounded-t-lg py-0.5">
                      <div>B</div>
                      <div>I</div>
                      <div>N</div>
                      <div>G</div>
                      <div>O</div>
                    </div>
                    <div className="grid grid-cols-5 border border-slate-900">
                      {table6.grid.map((row, rIdx) =>
                        row.map((val, cIdx) => (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            className={`py-1 text-center font-black text-xs border border-slate-300 ${
                              val === 0
                                ? "bg-amber-300 text-slate-950 text-[10px]"
                                : "bg-white text-slate-950"
                            }`}
                          >
                            {val === 0 ? "★" : val > 0 ? val : ""}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSelectCard(card);
                  }}
                  className={`w-full py-2.5 rounded-xl font-black text-xs sm:text-sm cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-white"
                  }`}
                >
                  {isSelected
                    ? `✔ Tabla #${card.cardNumber} Seleccionada (Toca para quitar)`
                    : `👉 Elegir Tabla #${card.cardNumber}`}
                </button>
              </div>
            );
          })}
        </section>
      </main>

      {/* MODAL PARA VER LOS 6 JUEGOS COMPLETOS (B-I-N-G-O + LLENA) DE UNA TABLA */}
      {previewCard && (
        <div
          onClick={() => setPreviewCard(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-4 border-amber-400 rounded-3xl p-4 sm:p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="bg-amber-400 text-slate-950 font-black px-3 py-0.5 rounded-full text-xs">
                  VISTA COMPLETA DE LA HOJA #{previewCard.cardNumber}
                </span>
                <h3 className="text-xl font-black text-white mt-1">
                  Los 6 Juegos de la Tabla #{previewCard.cardNumber} (Letras B -
                  I - N - G - O + Tabla Llena)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleSelectCard(previewCard);
                    setPreviewCard(null);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs sm:text-sm cursor-pointer"
                >
                  {selectedCardNumbers.includes(previewCard.cardNumber)
                    ? "Quitar Selección"
                    : `✅ Elegir esta Tabla #${previewCard.cardNumber}`}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewCard(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {previewCard.tables.map((t) => (
                <BingoTableCard
                  key={t.tableIndex}
                  tableIndex={t.tableIndex}
                  serialCode={t.serialCode}
                  grid={t.grid}
                  markedNumbers={[]}
                  drawnBalls={[]}
                  isActiveTable={false}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BARRA INFERIOR FLOTANTE PARA CONFIRMAR Y CERRAR EL ENLACE */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t-4 border-emerald-500 p-3 sm:p-4 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs sm:text-sm font-bold text-slate-200">
            {selectedCardNumbers.length === allowedQty ? (
              <span className="text-emerald-400 font-black">
                🎉 ¡Listo! Has elegido tus {allowedQty}{" "}
                {allowedQty === 1 ? "tabla" : "tablas"}:{" "}
                {selectedCardNumbers.map((n) => `#${n}`).join(", ")}
              </span>
            ) : (
              <span>
                Selecciona{" "}
                <strong className="text-amber-300">
                  {allowedQty - selectedCardNumbers.length} tabla(s) más
                </strong>{" "}
                para completar tu cupo de {allowedQty}.
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={selectedCardNumbers.length !== allowedQty || submitting}
            onClick={handleConfirmSelection}
            className={`px-6 py-3 rounded-2xl font-black text-sm sm:text-base shadow-xl transition-all cursor-pointer ${
              selectedCardNumbers.length === allowedQty
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            {submitting
              ? "Guardando tus tablas..."
              : `✅ Confirmar mis ${allowedQty} ${
                  allowedQty === 1 ? "Tabla" : "Tablas"
                } y Cerrar Enlace ➔`}
          </button>
        </div>
      </div>
    </div>
  );
}
