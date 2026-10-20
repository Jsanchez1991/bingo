"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { SaasOrganizer } from "@/lib/bingo-store";
import {
  SAAS_PLANS,
  SaasPlanId,
  SaasPlanDefinition,
} from "@/lib/bingo-patterns";
import {
  getSaasSession,
  setSaasSession,
  clearSaasSession,
  BingoSaasSession,
} from "@/lib/bingo-auth";

interface EventSummaryItem {
  eventId: string;
  organizerId: string;
  organizerName: string;
  planId: SaasPlanId;
  title: string;
  dateTimeText: string;
  priceText: string;
  status: string;
  cardsCount: number;
  sellersCount: number;
  drawnBallsCount: number;
}

export default function SaasSuperAdminPage() {
  const [session, setSession] = useState<BingoSaasSession | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [masterCode, setMasterCode] = useState<string>("");
  const [loginErr, setLoginErr] = useState<string | null>(null);

  const [organizers, setOrganizers] = useState<SaasOrganizer[]>([]);
  const [eventsList, setEventsList] = useState<EventSummaryItem[]>([]);
  const [activeDefaultEventId, setActiveDefaultEventId] = useState<string>("");
  const [banner, setBanner] = useState<string | null>(null);

  // Formulario para dar de alta un nuevo Organizador (Cliente SaaS)
  const [orgName, setOrgName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [planId, setPlanId] = useState<SaasPlanId>("PLAN_BASICO");
  const [firstEventTitle, setFirstEventTitle] = useState("");
  const [priceText, setPriceText] = useState("$2.00");

  // Estado para editar los datos, usuario y contraseña de un Organizador existente
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAccessCode, setEditAccessCode] = useState("");

  // Modal/Formulario rápido para crear otro evento a un organizador existente
  const [newEventOrgId, setNewEventOrgId] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("Domingo 20h00");
  const [newEventPrice, setNewEventPrice] = useState("$2.00");

  useEffect(() => {
    setSession(getSaasSession());
    setAuthChecked(true);
  }, []);

  const fetchSaas = useCallback(async () => {
    try {
      const res = await fetch("/api/bingo", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setOrganizers(data.organizers || []);
      setEventsList(data.eventsList || []);
      setActiveDefaultEventId(data.activeDefaultEventId || "");
    } catch {}
  }, []);

  useEffect(() => {
    fetchSaas();
  }, [fetchSaas]);

  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(null);
    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "LOGIN",
        role: "SUPERADMIN",
        identifier: "superadmin@bingo.ec",
        accessCode: masterCode,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setLoginErr(data.message || "Clave Maestra incorrecta.");
      return;
    }
    setSaasSession(data.session);
    setSession(data.session);
  };

  if (authChecked && (!session || session.role !== "SUPERADMIN")) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border-4 border-purple-500 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div>
            <span className="inline-block bg-purple-500 text-white font-black px-3 py-1 rounded-full text-xs uppercase">
              👑 ACCESO EXCLUSIVO SUPER-ADMIN SAAS
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mt-2">
              Centro de Negocio SaaS
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Ingrese la Clave Maestra del propietario de la plataforma para
              gestionar organizadores, planes y facturación.
            </p>
          </div>

          {loginErr && (
            <div className="bg-red-950 border-2 border-red-500 text-red-200 p-3 rounded-xl font-bold text-xs">
              ⚠️ {loginErr}
            </div>
          )}

          <form onSubmit={handleMasterLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-purple-300 mb-1">
                Clave Maestra Super-Admin
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={masterCode}
                onChange={(e) => setMasterCode(e.target.value)}
                className="w-full bg-slate-950 border-2 border-purple-500 rounded-xl px-4 py-3 text-lg font-black text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-base shadow-lg cursor-pointer"
            >
              Ingresar al Centro de Negocio ➔
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

  const showNotice = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 4500);
  };

  const handleCreateOrganizer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_ORGANIZER",
        name: orgName,
        organizationName: companyName || orgName,
        email,
        phone,
        accessCode: accessCode.trim() || undefined,
        planId,
        firstEventTitle:
          firstEventTitle || `GRAN BINGO ${(companyName || orgName).toUpperCase()}`,
        priceText,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setOrganizers(data.organizers || []);
      setEventsList(data.eventsList || []);
      setActiveDefaultEventId(data.activeDefaultEventId || "");
      setOrgName("");
      setCompanyName("");
      setEmail("");
      setPhone("");
      setAccessCode("");
      setFirstEventTitle("");
      showNotice(
        `✅ Organizador "${data.newOrganizer.organizationName}" creado (Usuario: ${data.newOrganizer.email} | Clave: ${data.newOrganizer.accessCode}) con ${
          SAAS_PLANS[data.newOrganizer.planId as SaasPlanId].name
        }.`
      );
    }
  };

  const handleStartEditOrganizer = (org: SaasOrganizer) => {
    setEditingOrgId(org.id);
    setEditName(org.name);
    setEditCompany(org.organizationName);
    setEditEmail(org.email);
    setEditPhone(org.phone);
    setEditAccessCode(org.accessCode);
  };

  const handleSaveEditOrganizer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrgId) return;
    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_ORGANIZER",
        organizerId: editingOrgId,
        name: editName,
        organizationName: editCompany,
        email: editEmail,
        phone: editPhone,
        accessCode: editAccessCode,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setOrganizers(data.organizers || []);
      setEventsList(data.eventsList || []);
      setEditingOrgId(null);
      showNotice(
        "✅ Datos, usuario y contraseña del organizador actualizados correctamente."
      );
    }
  };

  const handleDeleteOrganizer = async (org: SaasOrganizer) => {
    const confirmed = window.confirm(
      `¿Estás seguro de eliminar al organizador "${org.organizationName}" (${org.name}) y todos sus eventos? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "DELETE_ORGANIZER",
        organizerId: org.id,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setOrganizers(data.organizers || []);
      setEventsList(data.eventsList || []);
      setActiveDefaultEventId(data.activeDefaultEventId || "");
      showNotice(`🗑️ Organizador "${org.organizationName}" eliminado.`);
    } else {
      showNotice(`⚠️ ${data.message || "No se pudo eliminar el organizador."}`);
    }
  };

  const handleDeleteEvent = async (eventId: string, title: string) => {
    const confirmed = window.confirm(
      `¿Eliminar el evento "${title}" (${eventId})?`
    );
    if (!confirmed) return;

    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "DELETE_EVENT",
        targetEventId: eventId,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setEventsList(data.eventsList || []);
      setActiveDefaultEventId(data.activeDefaultEventId || "");
      showNotice(`🗑️ Evento "${title}" eliminado.`);
    } else {
      showNotice(`⚠️ ${data.message || "No se pudo eliminar el evento."}`);
    }
  };

  const handleUpdateOrganizerPlan = async (
    organizerId: string,
    nextPlanId?: SaasPlanId,
    nextStatus?: "ACTIVO" | "SUSPENDIDO"
  ) => {
    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_ORGANIZER_PLAN",
        organizerId,
        planId: nextPlanId,
        status: nextStatus,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setOrganizers(data.organizers || []);
      setEventsList(data.eventsList || []);
      showNotice("✅ Cuenta del organizador actualizada correctamente.");
    }
  };

  const handleCreateEventForOrganizer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventOrgId || !newEventTitle.trim()) return;
    const res = await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_EVENT",
        organizerId: newEventOrgId,
        title: newEventTitle,
        dateTimeText: newEventDate,
        priceText: newEventPrice,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showNotice(`⚠️ ${data.message || "No se pudo crear el evento."}`);
      return;
    }
    setEventsList(data.eventsList || []);
    setActiveDefaultEventId(data.activeDefaultEventId || "");
    setNewEventOrgId(null);
    setNewEventTitle("");
    showNotice("✅ Nuevo evento de Bingo creado y seleccionado como activo.");
  };

  const handleOpenEventInAdmin = async (eventId: string) => {
    await fetch("/api/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SWITCH_ACTIVE_EVENT",
        targetEventId: eventId,
      }),
    });
    window.location.href = `/admin?eventId=${encodeURIComponent(eventId)}`;
  };

  const totalRevenueUsd = organizers.reduce(
    (acc, o) => acc + (o.totalPaidUsd || 0),
    0
  );
  const totalCardsGenerated = eventsList.reduce(
    (acc, ev) => acc + ev.cardsCount,
    0
  );
  const totalSellers = eventsList.reduce((acc, ev) => acc + ev.sellersCount, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* BARRA SUPERIOR SUPER-ADMIN SAAS */}
      <header className="bg-slate-900 border-b-4 border-amber-400 px-4 py-5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-block bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-full text-xs uppercase">
              👑 PANEL SUPER-ADMIN SAAS • SESIÓN ACTIVA ({session?.name})
            </span>
            <h1 className="text-2xl sm:text-4xl font-black mt-1">
              Gran Bingo SaaS Ecuador — Centro de Negocio
            </h1>
            <p className="text-slate-400 text-sm font-semibold">
              Administra tus clientes organizadores, planes ($15 / $35 / $49),
              límites de tablas y eventos activos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/admin"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm sm:text-base shadow-lg"
            >
              🎛️ Ir a Cabina del Evento Activo ➔
            </a>
            <a
              href="/"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm sm:text-base border border-slate-700"
            >
              🏠 Inicio
            </a>
            <button
              type="button"
              onClick={() => {
                clearSaasSession();
                window.location.href = "/login";
              }}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm cursor-pointer"
            >
              🚪 Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-8">
        {banner && (
          <div className="bg-emerald-950 border-2 border-emerald-400 text-emerald-200 px-5 py-3.5 rounded-2xl font-black text-sm sm:text-base shadow-lg">
            {banner}
          </div>
        )}

        {/* 1. MÉTRICAS DEL NEGOCIO SAAS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-5 shadow-xl">
            <div className="text-xs font-extrabold uppercase text-emerald-400">
              Ingresos SaaS Facturados
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white mt-1">
              ${totalRevenueUsd.toFixed(2)}{" "}
              <span className="text-sm font-bold text-slate-400">USD</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Por planes por evento y suscripciones
            </div>
          </div>

          <div className="bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-5 shadow-xl">
            <div className="text-xs font-extrabold uppercase text-amber-400">
              Clientes Organizadores
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white mt-1">
              {organizers.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {organizers.filter((o) => o.status === "ACTIVO").length} cuentas
              activas
            </div>
          </div>

          <div className="bg-slate-900 border-2 border-sky-500/60 rounded-3xl p-5 shadow-xl">
            <div className="text-xs font-extrabold uppercase text-sky-400">
              Eventos de Bingo Creados
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white mt-1">
              {eventsList.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Cada evento con bolillero independiente
            </div>
          </div>

          <div className="bg-slate-900 border-2 border-purple-500/60 rounded-3xl p-5 shadow-xl">
            <div className="text-xs font-extrabold uppercase text-purple-400">
              Tablas Generadas / Vendedores
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white mt-1">
              {totalCardsGenerated}{" "}
              <span className="text-base font-bold text-slate-400">
                tablas ({totalCardsGenerated * 6} juegos)
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {totalSellers} vendedores/cajeros activos
            </div>
          </div>
        </section>

        {/* 2. CATÁLOGO DE PLANES SAAS (MODELO DE MONETIZACIÓN ECUADOR) */}
        <section className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              💎 Planes de Comercialización SaaS (Configurados con Bloqueo
              Automático de Cupos)
            </h2>
            <p className="text-slate-400 text-sm">
              El sistema controla automáticamente cuántas tablas y eventos puede
              crear cada organizador según el plan que te haya contratado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.values(SAAS_PLANS) as SaasPlanDefinition[]).map((p) => (
              <div
                key={p.id}
                className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <span
                    className={`inline-block font-black text-xs px-3 py-1 rounded-full ${p.badgeColor}`}
                  >
                    {p.name}
                  </span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">
                      ${p.priceUsd}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      USD / {p.billingPeriod}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {p.description}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-200 font-semibold">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-black">✔</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. REGISTRAR NUEVO CLIENTE ORGANIZADOR */}
        <section className="bg-slate-900 border-4 border-amber-400 rounded-3xl p-5 sm:p-6 shadow-2xl">
          <h2 className="text-xl sm:text-2xl font-black text-amber-400 mb-1">
            ➕ Dar de Alta Nuevo Organizador (Cliente SaaS)
          </h2>
          <p className="text-slate-300 text-sm mb-4">
            Cuando alguien te compra un plan por WhatsApp o transferencia,
            créalo aquí con su usuario y contraseña personalizados y se generará
            su cuenta junto con su primer evento listo para transmitir.
          </p>

          <form
            onSubmit={handleCreateOrganizer}
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800"
          >
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                Nombre del Responsable
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Patricio Cevallos"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                Organización / Canal En Vivo
              </label>
              <input
                type="text"
                placeholder="Ej. Bingo Barrial La Floresta"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-emerald-400 mb-1">
                Usuario / Correo de Acceso
              </label>
              <input
                type="text"
                required
                placeholder="Ej. patricio@bingo.ec"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border-2 border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-emerald-400 mb-1">
                Contraseña / Clave de Acceso
              </label>
              <input
                type="text"
                required
                placeholder="Ej. PATRICIO2025"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full bg-slate-900 border-2 border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-sm font-black text-emerald-300"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-amber-300 mb-1">
                Plan SaaS Contratado
              </label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value as SaasPlanId)}
                className="w-full bg-slate-900 border-2 border-amber-400 rounded-xl px-3.5 py-2.5 text-sm font-black text-amber-300 cursor-pointer"
              >
                <option value="DEMO_GRATIS">
                  Demo Gratis ($0 — Máx. 10 tablas)
                </option>
                <option value="PLAN_BASICO">
                  Plan Básico ($15 — Máx. 200 tablas + Vendedores)
                </option>
                <option value="PLAN_PRO">
                  Plan Pro ($35 — Máx. 1,000 tablas + Vendedores)
                </option>
                <option value="SUSCRIPCION_MENSUAL">
                  Plan Mensual TikTok/FB ($49/mes — Eventos Ilimitados)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                WhatsApp del Organizador
              </label>
              <input
                type="text"
                placeholder="099..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                Título de su Primer Bingo
              </label>
              <input
                type="text"
                placeholder="Ej. GRAN BINGO SOLIDARIO FAMILIA CEVALLOS"
                value={firstEventTitle}
                onChange={(e) => setFirstEventTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="w-24">
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                  Precio
                </label>
                <input
                  type="text"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-black text-amber-300"
                />
              </div>
              <button
                type="submit"
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 px-4 rounded-xl text-sm shadow-lg cursor-pointer"
              >
                🚀 Crear Organizador
              </button>
            </div>
          </form>
        </section>

        {/* 4. LISTADO DE ORGANIZADORES Y SUS EVENTOS MULTI-TENANT */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white">
            🏢 Organizadores Registrados y sus Eventos de Bingo (
            {organizers.length})
          </h2>

          {organizers.map((org) => {
            const orgPlan = SAAS_PLANS[org.planId] || SAAS_PLANS.DEMO_GRATIS;
            const orgEvents = eventsList.filter(
              (ev) => ev.organizerId === org.id
            );

            return (
              <div
                key={org.id}
                className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-black text-xs px-3 py-1 rounded-full ${orgPlan.badgeColor}`}
                      >
                        {orgPlan.name} (${orgPlan.priceUsd} USD)
                      </span>
                      <span
                        className={`font-black text-xs px-2.5 py-1 rounded-full ${
                          org.status === "ACTIVO"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-600"
                            : "bg-red-950 text-red-400 border border-red-600"
                        }`}
                      >
                        ● {org.status}
                      </span>
                      <span className="text-xs font-mono bg-slate-950 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300">
                        👤 Usuario: <strong className="text-white">{org.email}</strong>
                      </span>
                      <span className="text-xs font-mono bg-slate-950 border border-emerald-600/50 px-2.5 py-1 rounded-lg text-emerald-300">
                        🔑 Contraseña: <strong>{org.accessCode}</strong>
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                      {org.organizationName}{" "}
                      <span className="text-slate-400 text-base font-bold">
                        ({org.name})
                      </span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 font-semibold">
                      WhatsApp: {org.phone} • Facturado Total:{" "}
                      <strong className="text-emerald-400">
                        ${org.totalPaidUsd.toFixed(2)} USD
                      </strong>{" "}
                      • Cupo por evento:{" "}
                      <strong className="text-amber-300">
                        hasta {orgPlan.maxCardsPerEvent} tablas
                      </strong>
                    </p>
                  </div>

                  {/* Controles Super-Admin sobre este Organizador */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={org.planId}
                      onChange={(e) =>
                        handleUpdateOrganizerPlan(
                          org.id,
                          e.target.value as SaasPlanId
                        )
                      }
                      className="bg-slate-950 border-2 border-amber-400 rounded-xl px-3 py-2 text-xs sm:text-sm font-black text-amber-300 cursor-pointer"
                    >
                      <option value="DEMO_GRATIS">Cambiar a Demo Gratis</option>
                      <option value="PLAN_BASICO">
                        Subir a Plan Básico ($15)
                      </option>
                      <option value="PLAN_PRO">Subir a Plan Pro ($35)</option>
                      <option value="SUSCRIPCION_MENSUAL">
                        Subir a Mensual ($49)
                      </option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        editingOrgId === org.id
                          ? setEditingOrgId(null)
                          : handleStartEditOrganizer(org)
                      }
                      className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                    >
                      ✏️ Editar / Clave
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewEventOrgId(org.id)}
                      className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                    >
                      ➕ Nuevo Evento ({orgEvents.length}/{orgPlan.maxEvents})
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateOrganizerPlan(
                          org.id,
                          undefined,
                          org.status === "ACTIVO" ? "SUSPENDIDO" : "ACTIVO"
                        )
                      }
                      className={`px-3 py-2 rounded-xl font-bold text-xs cursor-pointer border ${
                        org.status === "ACTIVO"
                          ? "bg-amber-950/60 text-amber-300 border-amber-700 hover:bg-amber-900"
                          : "bg-emerald-950 text-emerald-300 border-emerald-600"
                      }`}
                    >
                      {org.status === "ACTIVO" ? "Suspender" : "Reactivar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteOrganizer(org)}
                      className="px-3 py-2 rounded-xl font-black text-xs cursor-pointer bg-red-600 hover:bg-red-500 text-white"
                      title="Eliminar organizador y sus eventos"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>

                {/* Formulario inline para EDITAR datos, usuario y contraseña de este organizador */}
                {editingOrgId === org.id && (
                  <form
                    onSubmit={handleSaveEditOrganizer}
                    className="bg-slate-950 border-2 border-amber-400 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
                  >
                    <div>
                      <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                        Nombre Responsable
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                        Organización
                      </label>
                      <input
                        type="text"
                        required
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase text-emerald-400 mb-1">
                        Usuario / Correo Login
                      </label>
                      <input
                        type="text"
                        required
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full bg-slate-900 border-2 border-emerald-500/70 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase text-emerald-400 mb-1">
                        Contraseña / Clave
                      </label>
                      <input
                        type="text"
                        required
                        value={editAccessCode}
                        onChange={(e) => setEditAccessCode(e.target.value)}
                        className="w-full bg-slate-900 border-2 border-emerald-500/70 rounded-xl px-3 py-2 text-xs sm:text-sm font-black text-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">
                        WhatsApp
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3 py-2 rounded-xl text-xs sm:text-sm cursor-pointer"
                      >
                        💾 Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOrgId(null)}
                        className="text-slate-400 hover:text-white text-xs font-bold px-2 py-2 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                {/* Formulario inline para crear nuevo evento a este organizador */}
                {newEventOrgId === org.id && (
                  <form
                    onSubmit={handleCreateEventForOrganizer}
                    className="bg-slate-950 border-2 border-sky-500 rounded-2xl p-4 flex flex-wrap items-end gap-3"
                  >
                    <div className="flex-1 min-w-[220px]">
                      <label className="block text-xs font-black uppercase text-sky-400 mb-1">
                        Título del Nuevo Evento de Bingo
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. GRAN BINGO FIN DE MES"
                        value={newEventTitle}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                        Fecha / Hora
                      </label>
                      <input
                        type="text"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs font-black uppercase text-slate-400 mb-1">
                        Valor Tabla
                      </label>
                      <input
                        type="text"
                        value={newEventPrice}
                        onChange={(e) => setNewEventPrice(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-amber-300"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-4 py-2 rounded-xl text-sm cursor-pointer"
                    >
                      Crear Evento
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEventOrgId(null)}
                      className="text-slate-400 hover:text-white text-xs font-bold px-2 py-2 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </form>
                )}

                {/* Eventos de este organizador */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {orgEvents.map((ev) => {
                    const isDefault = ev.eventId === activeDefaultEventId;
                    const usagePct = Math.min(
                      100,
                      Math.round(
                        (ev.cardsCount / orgPlan.maxCardsPerEvent) * 100
                      )
                    );
                    return (
                      <div
                        key={ev.eventId}
                        className={`rounded-2xl p-4 border-2 flex flex-col justify-between space-y-3 ${
                          isDefault
                            ? "bg-slate-950 border-emerald-500"
                            : "bg-slate-950 border-slate-800"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-slate-400">
                              ID: {ev.eventId}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isDefault && (
                                <span className="bg-emerald-500 text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded-full">
                                  ● ACTIVO EN CABINA
                                </span>
                              )}
                              {eventsList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteEvent(ev.eventId, ev.title)
                                  }
                                  className="text-red-400 hover:text-red-300 text-xs font-bold px-1.5 py-0.5 rounded bg-red-950/50 border border-red-800/60 cursor-pointer"
                                  title="Eliminar este evento"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                          <h4 className="text-lg font-black text-white mt-1">
                            {ev.title}
                          </h4>
                          <p className="text-xs text-slate-400 font-semibold">
                            📅 {ev.dateTimeText} • Valor:{" "}
                            <span className="text-amber-300">
                              {ev.priceText}
                            </span>{" "}
                            • Bolillas cantadas: {ev.drawnBallsCount}/75
                          </p>

                          {/* Barra de consumo de tablas del Plan */}
                          <div className="mt-3">
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span className="text-slate-300">
                                Tablas Vendidas: {ev.cardsCount} /{" "}
                                {orgPlan.maxCardsPerEvent}
                              </span>
                              <span className="text-amber-300">
                                {usagePct}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-amber-400"
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenEventInAdmin(ev.eventId)}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm text-center cursor-pointer"
                        >
                          🎛️ Abrir Cabina de este Evento ➔
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
