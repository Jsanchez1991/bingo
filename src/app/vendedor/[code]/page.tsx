"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type {
  BingoGameState,
  EventSeller,
  SaasOrganizer,
} from "@/lib/bingo-store";
import {
  SaasPlanDefinition,
  parsePriceUsd,
} from "@/lib/bingo-patterns";

export default function SellerPosPage() {
  const params = useParams();
  const sellerCode = String(params?.code || "");

  const [gameState, setGameState] = useState<BingoGameState | null>(null);
  const [seller, setSeller] = useState<EventSeller | null>(null);
  const [organizer, setOrganizer] = useState<SaasOrganizer | null>(null);
  const [plan, setPlan] = useState<SaasPlanDefinition | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [buyerName, setBuyerName] = useState<string>("");
  const [buyerPhone, setBuyerPhone] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [selBuyerName, setSelBuyerName] = useState<string>("");
  const [selBuyerPhone, setSelBuyerPhone] = useState<string>("");
  const [selAllowedQty, setSelAllowedQty] = useState<number>(3);
  const [statusMessage, setStatusMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchSellerData = useCallback(async () => {
    if (!sellerCode) return;
    try {
      const res = await fetch(
        `/api/bingo?sellerCode=${encodeURIComponent(sellerCode)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setErrorMsg("Enlace de vendedor no encontrado o desactivado.");
        return;
      }
      const data = await res.json();
      setGameState(data.state);
      setSeller(data.seller);
      setOrganizer(data.organizer);
      setPlan(data.plan);
      setErrorMsg(null);
    } catch {
      setErrorMsg("Error de conexión con el servidor.");
    }
  }, [sellerCode]);

  useEffect(() => {
    fetchSellerData();
    const interval = setInterval(fetchSellerData, 2500);
    return () => clearInterval(interval);
  }, [fetchSellerData]);

  const handleSellCards = async (
    e: React.FormEvent,
    existingToken?: string,
    existingName?: string,
    existingPhone?: string
  ) => {
    e.preventDefault();
    const targetName = existingName ?? buyerName;
    const targetPhone = existingPhone ?? buyerPhone;
    const targetQty = existingToken ? 1 : quantity;

    if (!targetName.trim()) return;

    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_CARD",
        sellerCode,
        buyerName: targetName,
        buyerPhone: targetPhone,
        quantity: targetQty,
        existingSecretToken: existingToken,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      setStatusMessage({
        type: "error",
        text: data.message || "No se pudo generar la tabla.",
      });
      return;
    }

    setGameState(data.state);
    if (!existingToken) {
      setBuyerName("");
      setBuyerPhone("");
      setQuantity(1);
    }
    setStatusMessage({
      type: "ok",
      text: `✅ ¡Se generaron ${targetQty} ${
        targetQty === 1 ? "tabla" : "tablas"
      } para ${targetName}! Envía el link por WhatsApp.`,
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border-4 border-red-500 rounded-3xl p-8 max-w-md space-y-4">
          <div className="text-4xl">🚫</div>
          <h1 className="text-2xl font-black text-red-400">{errorMsg}</h1>
          <p className="text-slate-300 text-sm">
            Verifica que el código de vendedor sea correcto o solicita un nuevo
            enlace al organizador del bingo.
          </p>
          <a
            href="/"
            className="inline-block bg-amber-400 text-slate-950 font-black px-6 py-3 rounded-xl"
          >
            Volver al Inicio
          </a>
        </div>
      </div>
    );
  }

  if (!gameState || !seller) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-2xl font-black animate-pulse">
          Cargando Punto de Venta del Vendedor...
        </div>
      </div>
    );
  }

  const unitPrice = parsePriceUsd(gameState.event.priceText);
  const mySoldCards = gameState.cards.filter(
    (c) => c.soldBySellerId === seller.id && c.status !== "DISPONIBLE"
  );
  const myAssignedPoolCards = gameState.cards.filter(
    (c) => c.assignedSellerId === seller.id
  );
  const myAvailablePoolCards = myAssignedPoolCards.filter(
    (c) => c.status === "DISPONIBLE"
  );
  const totalAvailablePoolCards = gameState.cards.filter(
    (c) => c.status === "DISPONIBLE" && (!c.assignedSellerId || c.assignedSellerId === seller.id)
  );
  const mySelectionLinks = (gameState.selectionLinks || []).filter(
    (l) => l.sellerId === seller.id
  );
  const totalGrossUsd = mySoldCards.length * unitPrice;
  const myCommissionUsd = totalGrossUsd * ((seller.commissionPercent || 0) / 100);
  const netToOrganizerUsd = totalGrossUsd - myCommissionUsd;

  const handleCreateSelectionLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selBuyerName.trim()) return;
    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_SELECTION_LINK",
        sellerCode,
        buyerName: selBuyerName,
        buyerPhone: selBuyerPhone,
        allowedQuantity: selAllowedQty,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setStatusMessage({
        type: "error",
        text: data.message || "No se pudo crear el link de elección.",
      });
      return;
    }
    setGameState(data.state);
    setSelBuyerName("");
    setSelBuyerPhone("");
    setStatusMessage({
      type: "ok",
      text: `✅ Link temporal creado para ${selBuyerName} (Vale por ${selAllowedQty} tablas). Envíalo por WhatsApp.`,
    });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const getWhatsAppShareUrl = (
    cardNumbers: string[],
    secretToken: string,
    cName: string,
    cPhone: string
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
    const text = `🎉 *${gameState.event.title}* 🎉\nHola *${cName}*, te saluda *${seller.name}*. Aquí tienes ${cardsLabel}.\n\n👉 *Toca este enlace único para abrir tus tablas, pintar tus números y cantar BINGO en vivo:*\n${cardUrl}\n\n🔒 _Enlace personal para 1 solo teléfono. También puedes imprimir tu PDF en 1 hoja A4._`;
    const cleanPhone = cPhone.replace(/\D/g, "");
    const ecPhone = cleanPhone.startsWith("0")
      ? `593${cleanPhone.slice(1)}`
      : cleanPhone;
    return ecPhone
      ? `https://wa.me/${ecPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Agrupar clientes vendidos por este vendedor
  const myClientGroups: {
    secretToken: string;
    buyerName: string;
    buyerPhone: string;
    cards: typeof mySoldCards;
  }[] = [];
  const mapByToken = new Map<string, (typeof myClientGroups)[number]>();
  for (const c of mySoldCards) {
    let grp = mapByToken.get(c.secretToken);
    if (!grp) {
      grp = {
        secretToken: c.secretToken,
        buyerName: c.buyerName,
        buyerPhone: c.buyerPhone,
        cards: [],
      };
      mapByToken.set(c.secretToken, grp);
      myClientGroups.push(grp);
    }
    grp.cards.push(c);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <header className="bg-slate-900 border-b-4 border-emerald-400 px-4 py-4 shadow-xl">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full">
                💼 PUNTO DE VENTA OFICIAL (CAJERO / VENDEDOR)
              </span>
              {!seller.active && (
                <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full">
                  PAUSADO POR ORGANIZADOR
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-1">
              {seller.name} — {gameState.event.title}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm font-bold">
              Organiza: {organizer?.organizationName || gameState.event.organizedBy} •
              Valor por Tabla:{" "}
              <span className="text-amber-300">{gameState.event.priceText}</span>{" "}
              • Tu Comisión:{" "}
              <span className="text-emerald-400">
                {seller.commissionPercent}%
              </span>
            </p>
          </div>

          <a
            href="/"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700"
          >
            🏠 Inicio
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* RESUMEN DE CUADRE DE CAJA DEL VENDEDOR */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-extrabold uppercase text-slate-400">
              Tablas Vendidas por Ti
            </div>
            <div className="text-3xl font-black text-white mt-1">
              {mySoldCards.length}{" "}
              <span className="text-sm font-bold text-slate-400">hojas</span>
            </div>
          </div>

          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-extrabold uppercase text-slate-400">
              Total Cobrado ({gameState.event.priceText} c/u)
            </div>
            <div className="text-3xl font-black text-amber-400 mt-1">
              ${totalGrossUsd.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4">
            <div className="text-xs font-extrabold uppercase text-emerald-400">
              Tu Ganancia ({seller.commissionPercent}%)
            </div>
            <div className="text-3xl font-black text-emerald-400 mt-1">
              ${myCommissionUsd.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-900 border-2 border-sky-500/50 rounded-2xl p-4">
            <div className="text-xs font-extrabold uppercase text-sky-400">
              Entregar al Organizador
            </div>
            <div className="text-3xl font-black text-sky-300 mt-1">
              ${netToOrganizerUsd.toFixed(2)}
            </div>
          </div>
        </section>

        {/* FORMULARIO PARA VENDER NUEVAS TABLAS */}
        <section className="bg-slate-900 border-4 border-amber-400 rounded-3xl p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-amber-400">
                🎟️ Vender Tablas y Generar Link Único de WhatsApp
              </h2>
              <p className="text-slate-300 text-sm">
                Si un cliente compra 2 o más tablas, todas se abren en su mismo
                link con el <strong>Modo Tablero Doblado</strong>.
              </p>
            </div>
            {plan && (
              <span className="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300">
                {myAssignedPoolCards.length > 0 ? (
                  <>
                    📦 Tu Lote Asignado: {myAssignedPoolCards.length} tablas (
                    {myAvailablePoolCards.length} disponibles)
                  </>
                ) : (
                  <>
                    Cupo del Evento:{" "}
                    {gameState.cards.filter((c) => c.status !== "DISPONIBLE").length} /{" "}
                    {gameState.pregeneratedPoolSize || plan.maxCardsPerEvent} tablas
                  </>
                )}
              </span>
            )}
          </div>

          {statusMessage && (
            <div
              className={`mb-4 p-3.5 rounded-2xl font-black text-sm ${
                statusMessage.type === "ok"
                  ? "bg-emerald-950 border-2 border-emerald-500 text-emerald-300"
                  : "bg-red-950 border-2 border-red-500 text-red-300"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          <form
            onSubmit={(e) => handleSellCards(e)}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3"
          >
            <input
              type="text"
              required
              disabled={!seller.active}
              placeholder="Nombre completo del comprador(a)"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="sm:col-span-1 bg-slate-950 border-2 border-slate-700 rounded-xl px-4 py-3 text-base font-bold text-white"
            />
            <input
              type="text"
              disabled={!seller.active}
              placeholder="WhatsApp (ej. 0991234567)"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              className="sm:col-span-1 bg-slate-950 border-2 border-slate-700 rounded-xl px-4 py-3 text-base font-bold text-white"
            />
            <select
              value={quantity}
              disabled={!seller.active}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="sm:col-span-1 bg-slate-950 border-2 border-amber-400 rounded-xl px-4 py-3 text-base font-black text-amber-300 cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((q) => (
                <option key={q} value={q}>
                  {q} {q === 1 ? "Tabla" : "Tablas"} ($
                  {(q * unitPrice).toFixed(2)})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!seller.active}
              className="sm:col-span-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black px-5 py-3 rounded-xl text-base shadow-lg cursor-pointer"
            >
              ➕ Vender {quantity} {quantity === 1 ? "Tabla" : "Tablas"}
            </button>
          </form>
        </section>

        {/* ENLACE DE ELECCIÓN PARA EL CLIENTE ("VALE POR X TABLAS") */}
        <section className="bg-slate-900 border-4 border-fuchsia-500 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-fuchsia-400">
                🔗 Enviar Link para que el Cliente Elija sus Tablas (&ldquo;Vale por X Tablas&rdquo;)
              </h2>
              <p className="text-slate-300 text-sm">
                El cliente abre el enlace, ve las tablas disponibles de tu talonario con sus números, elige las que le gustan y el enlace se cierra automáticamente.
              </p>
            </div>
            <div className="bg-slate-950 border border-fuchsia-500/40 px-3 py-1.5 rounded-xl text-xs font-black text-fuchsia-300">
              {myAssignedPoolCards.length > 0 ? (
                <>
                  📦 Tu Talonario: #{myAssignedPoolCards[0]?.cardNumber} a #
                  {myAssignedPoolCards[myAssignedPoolCards.length - 1]?.cardNumber} •{" "}
                  <span className="text-emerald-400">
                    {myAvailablePoolCards.length} Libres
                  </span>
                </>
              ) : (
                <>
                  📦 Tablas Libres para Elegir: {totalAvailablePoolCards.length}
                </>
              )}
            </div>
          </div>

          <form
            onSubmit={handleCreateSelectionLink}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3"
          >
            <input
              type="text"
              required
              disabled={!seller.active}
              placeholder="Nombre del cliente"
              value={selBuyerName}
              onChange={(e) => setSelBuyerName(e.target.value)}
              className="sm:col-span-1 bg-slate-950 border-2 border-slate-700 rounded-xl px-4 py-3 text-base font-bold text-white"
            />
            <input
              type="text"
              disabled={!seller.active}
              placeholder="WhatsApp (ej. 0991234567)"
              value={selBuyerPhone}
              onChange={(e) => setSelBuyerPhone(e.target.value)}
              className="sm:col-span-1 bg-slate-950 border-2 border-slate-700 rounded-xl px-4 py-3 text-base font-bold text-white"
            />
            <select
              value={selAllowedQty}
              disabled={!seller.active}
              onChange={(e) => setSelAllowedQty(Number(e.target.value))}
              className="sm:col-span-1 bg-slate-950 border-2 border-fuchsia-400 rounded-xl px-4 py-3 text-base font-black text-fuchsia-300 cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((q) => (
                <option key={q} value={q}>
                  Vale por {q} {q === 1 ? "Tabla" : "Tablas"} ($
                  {(q * unitPrice).toFixed(2)})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!seller.active || totalAvailablePoolCards.length === 0}
              className="sm:col-span-1 bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 text-white font-black px-5 py-3 rounded-xl text-sm sm:text-base shadow-lg cursor-pointer"
            >
              🔗 Crear Link ({selAllowedQty} {selAllowedQty === 1 ? "Tabla" : "Tablas"})
            </button>
          </form>

          {mySelectionLinks.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <div className="text-xs font-extrabold uppercase text-slate-400">
                Enlaces de Elección Creados por Ti ({mySelectionLinks.length}):
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mySelectionLinks.map((lnk) => {
                  const origin =
                    typeof window !== "undefined"
                      ? window.location.origin
                      : "http://localhost:3000";
                  const selectUrl = `${origin}/elegir/${lnk.code}`;
                  const waText = `🎉 *${gameState.event.title}* 🎉\nHola *${lnk.buyerName}*, te saluda *${seller.name}*. Aquí tienes tu enlace personal para que *elijas tus ${lnk.allowedQuantity} ${lnk.allowedQuantity === 1 ? "tabla" : "tablas"} de la suerte* viendo todos los números disponibles:\n\n👉 *Toca aquí para elegir tus tablas:*\n${selectUrl}\n\n🔒 _Enlace de 1 solo uso: apenas confirmes tus tablas se guardarán a tu nombre automáticamente._`;
                  const cleanPhone = (lnk.buyerPhone || "").replace(/\D/g, "");
                  const ecPhone = cleanPhone.startsWith("0")
                    ? `593${cleanPhone.slice(1)}`
                    : cleanPhone;
                  const waLink = ecPhone
                    ? `https://wa.me/${ecPhone}?text=${encodeURIComponent(waText)}`
                    : `https://wa.me/?text=${encodeURIComponent(waText)}`;

                  return (
                    <div
                      key={lnk.id}
                      className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between gap-2 ${
                        lnk.status === "COMPLETADO"
                          ? "bg-slate-950/70 border-emerald-500/40"
                          : "bg-slate-950 border-fuchsia-500/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                            lnk.status === "COMPLETADO"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40"
                          }`}
                        >
                          {lnk.status === "COMPLETADO"
                            ? `✅ ELEGIDAS (#${lnk.selectedCardNumbers.join(", #")})`
                            : `⏳ PENDIENTE DE ELEGIR (${lnk.allowedQuantity} TABLAS)`}
                        </span>
                      </div>

                      <div>
                        <div className="font-black text-white text-sm">
                          {lnk.buyerName}{" "}
                          <span className="text-xs text-slate-400 font-normal">
                            ({lnk.buyerPhone || "Sin tel"})
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono truncate">
                          /elegir/{lnk.code}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {lnk.status === "ACTIVO" ? (
                          <>
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-2 px-3 rounded-xl text-center"
                            >
                              📲 Enviar Link por WhatsApp
                            </a>
                            <a
                              href={`/elegir/${lnk.code}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2 px-3 rounded-xl border border-slate-700"
                            >
                              Abrir ↗
                            </a>
                          </>
                        ) : (
                          lnk.finalPlayerToken && (
                            <a
                              href={`/jugar/${lnk.finalPlayerToken}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-2 px-3 rounded-xl text-center"
                            >
                              🎟️ Ver Tablas del Cliente (/jugar/{lnk.finalPlayerToken})
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* LISTA DE CLIENTES ATENDIDOS POR ESTE VENDEDOR */}
        <section className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 sm:p-6">
          <h3 className="text-lg sm:text-xl font-black text-white mb-4">
            📋 Mis Clientes y Enlaces de WhatsApp ({myClientGroups.length}{" "}
            clientes / {mySoldCards.length} tablas)
          </h3>

          {myClientGroups.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 font-bold">
              Aún no has registrado ventas. Usa el formulario de arriba para
              vender tu primera tabla.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myClientGroups.map((grp) => {
                const cardNumbers = grp.cards.map((c) => c.cardNumber);
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
                      <div className="flex items-center justify-between gap-2">
                        <span className="bg-amber-400 text-slate-950 font-black px-3 py-0.5 rounded-full text-xs">
                          {grp.cards.length === 1
                            ? `1 TABLA (#${cardNumbers[0]})`
                            : `${grp.cards.length} TABLAS (${cardNumbers
                                .map((n) => `#${n}`)
                                .join(", ")})`}
                        </span>
                        <span className="text-xs font-black text-emerald-400">
                          Cobrado: ${(grp.cards.length * unitPrice).toFixed(2)}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-white mt-2">
                        {grp.buyerName}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono">
                        Tel: {grp.buyerPhone || "Sin teléfono"} • {playerPath}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm py-2.5 px-3 rounded-xl text-center"
                        >
                          📲 Enviar por WhatsApp
                        </a>
                        <a
                          href={playerPath}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-700"
                        >
                          Ver ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const fullUrl = `${window.location.origin}${playerPath}`;
                            navigator.clipboard.writeText(fullUrl);
                            setCopiedToken(grp.secretToken);
                            setTimeout(() => setCopiedToken(null), 2000);
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-700 cursor-pointer"
                        >
                          {copiedToken === grp.secretToken ? "✔" : "Copiar"}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!seller.active}
                          onClick={(e) =>
                            handleSellCards(
                              e,
                              grp.secretToken,
                              grp.buyerName,
                              grp.buyerPhone
                            )
                          }
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-extrabold text-xs cursor-pointer"
                        >
                          ➕ Agregar +1 Tabla
                        </button>
                        <button
                          type="button"
                          disabled={!seller.active}
                          onClick={async () => {
                            const ok = window.confirm(
                              `¿Eliminar a "${grp.buyerName}" y sus ${grp.cards.length} tabla(s)?`
                            );
                            if (!ok) return;
                            const res = await fetch("/api/bingo", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "DELETE_CARD_GROUP",
                                sellerCode,
                                secretToken: grp.secretToken,
                              }),
                            });
                            const data = await res.json();
                            if (data.ok && data.state) {
                              setGameState(data.state);
                            }
                          }}
                          className="py-2 px-3 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/60 text-red-300 hover:text-white font-black text-xs cursor-pointer transition-colors"
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
          )}
        </section>
      </main>
    </div>
  );
}
