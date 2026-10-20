"use client";

import React, { useEffect, useState } from "react";
import { SAAS_PLANS, SaasPlanId } from "@/lib/bingo-patterns";
import {
  getSaasSession,
  setSaasSession,
  clearSaasSession,
  BingoSaasSession,
} from "@/lib/bingo-auth";

type AuthMode = "LOGIN" | "REGISTER" | "PLAYER";

export default function HomePage() {
  const [mode, setMode] = useState<AuthMode>("LOGIN");
  const [session, setSession] = useState<BingoSaasSession | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Campos de Login Unificado (detecta automáticamente Super-Admin, Organizador o Vendedor)
  const [identifier, setIdentifier] = useState<string>("");
  const [accessCode, setAccessCode] = useState<string>("");

  // Campos de Registro de Nuevo Organizador
  const [regName, setRegName] = useState<string>("");
  const [regCompany, setRegCompany] = useState<string>("");
  const [regEmail, setRegEmail] = useState<string>("");
  const [regPhone, setRegPhone] = useState<string>("");
  const [regPassword, setRegPassword] = useState<string>("");
  const [regPlanId, setRegPlanId] = useState<SaasPlanId>("PAQUETE_100");
  const [regEventTitle, setRegEventTitle] = useState<string>("");
  const [regPriceText, setRegPriceText] = useState<string>("$2.00");

  // Campo de Código de Cartón de Jugador
  const [playerToken, setPlayerToken] = useState<string>("");

  useEffect(() => {
    setSession(getSaasSession());
  }, []);

  const handleUnifiedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() && !accessCode.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/bingo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LOGIN",
          role: "AUTO",
          identifier: identifier.trim(),
          accessCode: accessCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(
          data.message ||
            "Usuario o contraseña incorrectos. Verifique sus datos."
        );
        setLoading(false);
        return;
      }

      if (data.session) {
        setSaasSession(data.session);
        setSession(data.session);
      }

      if (data.redirectTo) {
        window.location.href = data.redirectTo;
      } else if (data.session?.role === "SUPERADMIN") {
        window.location.href = "/saas";
      } else if (data.session?.role === "SELLER") {
        window.location.href = `/vendedor/${data.session.sellerCode}`;
      } else {
        window.location.href = "/admin";
      }
    } catch {
      setErrorMsg("Error de conexión con el servidor.");
      setLoading(false);
    }
  };

  const handleRegisterOrganizer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPassword.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/bingo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_ORGANIZER",
          name: regName.trim(),
          organizationName: (regCompany || regName).trim(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
          accessCode: regPassword.trim(),
          planId: regPlanId,
          firstEventTitle:
            regEventTitle.trim() ||
            `GRAN BINGO ${(regCompany || regName).toUpperCase()}`,
          priceText: regPriceText.trim() || "$2.00",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.message || "No se pudo completar el registro.");
        setLoading(false);
        return;
      }

      const newOrg = data.newOrganizer;
      const newSession: BingoSaasSession = {
        role: "ORGANIZER",
        organizerId: newOrg.id,
        name: newOrg.name,
        email: newOrg.email,
        organizationName: newOrg.organizationName,
        planId: newOrg.planId,
        defaultEventId: data.newEventId,
        loggedInAt: new Date().toISOString(),
      };
      setSaasSession(newSession);
      window.location.href = "/admin";
    } catch {
      setErrorMsg("Error de conexión al registrar la cuenta.");
      setLoading(false);
    }
  };

  const handleOpenPlayerCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerToken.trim()) return;
    window.location.href = `/jugar/${encodeURIComponent(playerToken.trim())}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      {/* BARRA SUPERIOR CORPORATIVA */}
      <header className="border-b-4 border-amber-400 bg-slate-900 py-5 px-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white">
              B
            </div>
            <div>
              <span className="inline-block bg-amber-400/20 text-amber-300 border border-amber-400/40 font-black px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider">
                Plataforma SaaS • Formato Oficial Ecuatoriano 6 Tablas
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                GRAN BINGO DIGITAL CLOUD
              </h1>
            </div>
          </div>

          {session && (
            <div className="bg-slate-950 border-2 border-emerald-500 rounded-2xl px-4 py-2 flex items-center gap-3">
              <div>
                <div className="text-[10px] font-black uppercase text-emerald-400">
                  Sesión Iniciada ({session.role})
                </div>
                <div className="text-sm font-black text-white">
                  {session.name}
                </div>
              </div>
              <a
                href={
                  session.role === "SUPERADMIN"
                    ? "/saas"
                    : session.role === "SELLER"
                    ? `/vendedor/${session.sellerCode}`
                    : "/admin"
                }
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3 py-2 rounded-xl"
              >
                Ir a mi Panel ➔
              </a>
              <button
                type="button"
                onClick={() => {
                  clearSaasSession();
                  setSession(null);
                }}
                className="bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white font-bold text-xs px-2.5 py-2 rounded-xl cursor-pointer transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL: PRESENTACIÓN DEL SAAS + PORTAL DE LOGIN */}
      <main className="max-w-7xl mx-auto w-full px-4 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* COLUMNA IZQUIERDA (7 cols): PROPUESTA DE VALOR COMERCIAL Y PLANES */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <span className="inline-block bg-emerald-500 text-slate-950 font-black px-3.5 py-1 rounded-full text-xs sm:text-sm uppercase mb-3">
              🚀 Software para Organizadores de Bingo en Vivo
            </span>
            <h2 className="text-3xl sm:text-5xl font-black leading-tight text-white">
              Organiza, Vende y Verifica tu{" "}
              <span className="text-amber-400">Gran Bingo de 6 Tablas</span> en
              Tiempo Real
            </h2>
            <p className="text-slate-300 text-base sm:text-lg mt-3 leading-relaxed">
              Diseñado con el formato tradicional ecuatoriano{" "}
              <strong>(Letras B - I - N - G - O + Tabla Llena)</strong>. Vende
              cartones digitales o imprimibles por WhatsApp, asigna vendedores
              con comisión y verifica ganadores al instante durante tu
              transmisión en vivo.
            </p>
          </div>

          {/* Características clave */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-amber-400 font-black text-base mb-1">
                🛡️ Motor Anti-Duplicados + Candado IP
              </div>
              <p className="text-slate-400 text-xs sm:text-sm">
                Cada tabla generada tiene combinación única verificada y cada
                enlace de WhatsApp se bloquea en un solo dispositivo.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-emerald-400 font-black text-base mb-1">
                📂 Modo Tablero Doblado Multi-Hoja
              </div>
              <p className="text-slate-400 text-xs sm:text-sm">
                Si un jugador compra varias tablas, puede abrir todos sus Juegos
                #1 al mismo tiempo en una sola pantalla.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-sky-400 font-black text-base mb-1">
                💼 Red de Vendedores y Cuadre de Caja
              </div>
              <p className="text-slate-400 text-xs sm:text-sm">
                Crea accesos para tu equipo de ventas con cálculo automático de
                comisiones y dinero neto a entregar.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-purple-400 font-black text-base mb-1">
                🔊 Voz Cantadora + Desempate en Vivo
              </div>
              <p className="text-slate-400 text-xs sm:text-sm">
                Anuncio por voz en español en los celulares y sorteo automático
                &ldquo;Al Número Mayor&rdquo; en caso de empate.
              </p>
            </div>
          </div>

          {/* Resumen de Planes Comerciales */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5">
            <div className="text-xs font-black uppercase text-slate-400 mb-3">
              Planes Disponibles para Organizadores:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.values(SAAS_PLANS).map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center"
                >
                  <div className="text-xs font-black text-amber-300">
                    {p.name}
                  </div>
                  <div className="text-2xl font-black text-white my-1">
                    ${p.priceUsd}
                    <span className="text-[11px] font-bold text-slate-400">
                      {" "}
                      USD
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold">
                    Hasta {p.maxCardsPerEvent} tablas
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA (5 cols): TARJETA DE INICIO DE SESIÓN UNIFICADO */}
        <div className="lg:col-span-5 bg-slate-900 border-4 border-amber-400 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Selector de Pestañas */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode("LOGIN");
                setErrorMsg(null);
              }}
              className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm cursor-pointer transition-all ${
                mode === "LOGIN"
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              🔐 Iniciar Sesión
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("REGISTER");
                setErrorMsg(null);
              }}
              className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm cursor-pointer transition-all ${
                mode === "REGISTER"
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              ✨ Registrarse
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("PLAYER");
                setErrorMsg(null);
              }}
              className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm cursor-pointer transition-all ${
                mode === "PLAYER"
                  ? "bg-sky-400 text-slate-950 shadow-md"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              🎟️ Mi Cartón
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-950 border-2 border-red-500 text-red-200 p-3.5 rounded-2xl font-bold text-xs sm:text-sm">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* MODO 1: INICIAR SESIÓN UNIFICADO */}
          {mode === "LOGIN" && (
            <form onSubmit={handleUnifiedLogin} className="space-y-4">
              <div>
                <h3 className="text-2xl font-black text-white">
                  Acceso a la Plataforma
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Ingrese su usuario y contraseña. El sistema le dirigirá
                  automáticamente a su panel de{" "}
                  <strong>Organizador, Vendedor o Administración</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-amber-300 mb-1.5">
                  Usuario, Correo Electrónico o Celular
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Ingrese su correo o usuario"
                  className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 rounded-xl px-4 py-3.5 text-base font-bold text-white outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-amber-300 mb-1.5">
                  Contraseña / Clave de Acceso
                </label>
                <input
                  type="password"
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 rounded-xl px-4 py-3.5 text-base font-bold text-white outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-black text-lg shadow-xl cursor-pointer transition-all"
              >
                {loading ? "Verificando credenciales..." : "Ingresar al Sistema ➔"}
              </button>
            </form>
          )}

          {/* MODO 2: REGISTRO DE NUEVO ORGANIZADOR */}
          {mode === "REGISTER" && (
            <form onSubmit={handleRegisterOrganizer} className="space-y-3.5">
              <div>
                <h3 className="text-2xl font-black text-emerald-400">
                  Crear Cuenta de Organizador
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Configure su organización y comience a vender sus tablas de
                  Bingo en minutos.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                  Nombre del Responsable
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nombre y Apellido"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                  Nombre de la Organización o Evento
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Comité Barrial / Fundación / Canal Live"
                  value={regCompany}
                  onChange={(e) => setRegCompany(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="correo@dominio.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="099..."
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-emerald-400 mb-1">
                    Contraseña de Acceso
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Cree su contraseña"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-amber-300 mb-1">
                    Plan Seleccionado
                  </label>
                  <select
                    value={regPlanId}
                    onChange={(e) => setRegPlanId(e.target.value as SaasPlanId)}
                    className="w-full bg-slate-950 border border-amber-400 rounded-xl px-3 py-2.5 text-sm font-black text-amber-300 cursor-pointer"
                  >
                    {Object.values(SAAS_PLANS).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.priceUsd} USD)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                    Título de su Primer Bingo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. GRAN BINGO SOLIDARIO"
                    value={regEventTitle}
                    onChange={(e) => setRegEventTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                    Precio Tabla
                  </label>
                  <input
                    type="text"
                    value={regPriceText}
                    onChange={(e) => setRegPriceText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-amber-300"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base shadow-xl cursor-pointer"
              >
                {loading
                  ? "Creando cuenta..."
                  : "Crear Cuenta e Ingresar al Panel ➔"}
              </button>
            </form>
          )}

          {/* MODO 3: ACCESO JUGADOR CON CÓDIGO DE CARTÓN */}
          {mode === "PLAYER" && (
            <form onSubmit={handleOpenPlayerCard} className="space-y-4">
              <div>
                <h3 className="text-2xl font-black text-sky-400">
                  Abrir Mi Cartón de Juego
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Si compró una o varias tablas de Bingo, ingrese el código de su
                  enlace o utilice el link personal enviado a su WhatsApp.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-sky-300 mb-1.5">
                  Código de Cartón o Token Personal
                </label>
                <input
                  type="text"
                  required
                  value={playerToken}
                  onChange={(e) => setPlayerToken(e.target.value)}
                  placeholder="Ingrese el código recibido por WhatsApp"
                  className="w-full bg-slate-950 border-2 border-slate-700 focus:border-sky-400 rounded-xl px-4 py-3.5 text-base font-bold text-white outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-lg shadow-xl cursor-pointer"
              >
                🎟️ Abrir Mis Tablas de Bingo ➔
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 py-4 px-4 text-center text-slate-400 text-xs sm:text-sm font-semibold">
        Gran Bingo Digital Cloud • Plataforma SaaS para Eventos de Bingo en Vivo
        • Todos los derechos reservados
      </footer>
    </div>
  );
}
