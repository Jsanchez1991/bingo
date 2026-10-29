"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { formatBall, getBallLetter } from "@/lib/bingo-patterns";
import { playTumbleClack } from "@/lib/bingo-audio";

interface Ball3D {
  num: number;
  letter: string;
  color: string;
  textColor: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

interface BingoCage3DProps {
  drawnNumbers: number[];
  lastBall: number | null;
  onDrawBall: (ballNumber: number) => void;
  disabled?: boolean;
}

export default function BingoCage3D({
  drawnNumbers,
  lastBall,
  onDrawBall,
  disabled = false,
}: BingoCage3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [extractingBall, setExtractingBall] = useState<number | null>(null);
  const [rotationSpeed, setRotationSpeed] = useState<number>(0.02);

  // Set de bolillas ya jugadas
  const drawnSet = useMemo(() => new Set(drawnNumbers), [drawnNumbers]);

  // Bolillas aún disponibles en la tómbola (de 1 a 75)
  const availableNumbers = useMemo(() => {
    const list: number[] = [];
    for (let i = 1; i <= 75; i++) {
      if (!drawnSet.has(i)) list.push(i);
    }
    return list;
  }, [drawnSet]);

  // Helper para asignar color según letra B-I-N-G-O
  const getBallStyles = (n: number) => {
    const letter = getBallLetter(n);
    switch (letter) {
      case "B":
        return { letter, color: "#2563eb", textColor: "#ffffff" }; // Azul vibrante
      case "I":
        return { letter, color: "#e11d48", textColor: "#ffffff" }; // Rojo / Rose
      case "N":
        return { letter, color: "#10b981", textColor: "#ffffff" }; // Verde esmeralda
      case "G":
        return { letter, color: "#f59e0b", textColor: "#020617" }; // Ámbar / Dorado
      case "O":
      default:
        return { letter, color: "#8b5cf6", textColor: "#ffffff" }; // Morado
    }
  };

  // Referencia mutable para las bolas simuladas dentro de la esfera
  const ballsRef = useRef<Ball3D[]>([]);
  const isSpinningRef = useRef<boolean>(false);
  const speedRef = useRef<number>(0.02);
  const sphereAngleRef = useRef<number>(0);
  const lastClackTimeRef = useRef<number>(0);

  isSpinningRef.current = isSpinning;
  speedRef.current = rotationSpeed;

  // Inicializar o sincronizar las bolillas vivas en la esfera
  useEffect(() => {
    // Si la tómbola no tiene bolas o cambió la cantidad disponible significativamente
    const currentBalls = ballsRef.current;
    const existingMap = new Map<number, Ball3D>();
    currentBalls.forEach((b) => existingMap.set(b.num, b));

    // Si hay muchas disponibles (ej. 75), mostramos hasta ~45 activas en la esfera para máximo rendimiento visual
    const displayPool = availableNumbers.slice(0, 48);

    const nextBalls: Ball3D[] = displayPool.map((num) => {
      if (existingMap.has(num)) {
        return existingMap.get(num)!;
      }
      const st = getBallStyles(num);
      // Posición aleatoria dentro del radio de la esfera (radio = 85)
      const r = Math.random() * 65;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      return {
        num,
        letter: st.letter,
        color: st.color,
        textColor: st.textColor,
        x: r * Math.cos(theta) * Math.cos(phi),
        y: r * Math.sin(phi) + 20, // Caídas un poco hacia la parte inferior
        z: r * Math.sin(theta) * Math.cos(phi),
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        vz: (Math.random() - 0.5) * 1.5,
        rotX: Math.random() * Math.PI,
        rotY: Math.random() * Math.PI,
        rotZ: Math.random() * Math.PI,
      };
    });

    ballsRef.current = nextBalls;
  }, [availableNumbers]);

  // Bucle de física y renderizado 3D en el Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const SPHERE_RADIUS = 95;
    const BALL_RADIUS = 12;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2 - 12;

      ctx.clearRect(0, 0, width, height);

      // Avanzar ángulo de la tómbola
      const currentSpeed = speedRef.current;
      sphereAngleRef.current += currentSpeed;

      // Sonido aleatorio de choque cuando está girando
      if (isSpinningRef.current && currentSpeed > 0.05) {
        const now = performance.now();
        if (now - lastClackTimeRef.current > 120 + Math.random() * 200) {
          playTumbleClack();
          lastClackTimeRef.current = now;
        }
      }

      // 1. Dibujar soporte trasero de la tómbola (Base metálica negra y cromada)
      ctx.save();
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 4;

      // Eje central
      ctx.beginPath();
      ctx.moveTo(centerX - SPHERE_RADIUS - 18, centerY);
      ctx.lineTo(centerX + SPHERE_RADIUS + 18, centerY);
      ctx.strokeStyle = "#64748b";
      ctx.stroke();
      ctx.restore();

      // 2. Dibujar fondo interno de la esfera (vidrio oscurecido con reflejo profundo)
      ctx.save();
      const glassBg = ctx.createRadialGradient(
        centerX - 25,
        centerY - 30,
        15,
        centerX,
        centerY,
        SPHERE_RADIUS
      );
      glassBg.addColorStop(0, "rgba(56, 189, 248, 0.08)");
      glassBg.addColorStop(0.7, "rgba(15, 23, 42, 0.45)");
      glassBg.addColorStop(1, "rgba(2, 6, 23, 0.85)");

      ctx.beginPath();
      ctx.arc(centerX, centerY, SPHERE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = glassBg;
      ctx.fill();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // 3. Dibujar aspas internas / paletas metálicas que agitan las bolillas al girar
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(sphereAngleRef.current);
      ctx.strokeStyle = "rgba(203, 213, 225, 0.35)";
      ctx.lineWidth = 2.5;
      for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const armAngle = (arm * Math.PI) / 2;
        ctx.lineTo(
          Math.cos(armAngle) * (SPHERE_RADIUS - 6),
          Math.sin(armAngle) * (SPHERE_RADIUS - 6)
        );
        ctx.stroke();

        // Pequeño aro en el extremo de la paleta
        ctx.beginPath();
        ctx.arc(
          Math.cos(armAngle) * (SPHERE_RADIUS - 16),
          Math.sin(armAngle) * (SPHERE_RADIUS - 16),
          8,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();

      // 4. Actualizar y proyectar bolillas con perspectiva y Z-sort
      const balls = ballsRef.current;
      const spinActive = isSpinningRef.current;
      const gravity = spinActive ? 0.35 : 0.65;
      const bounce = 0.68;

      // Actualizar física
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];

        if (spinActive) {
          // Fuerza centrífuga y torbellino por giro
          const rotForceX = -b.y * currentSpeed * 2.8;
          const rotForceY = b.x * currentSpeed * 2.8;
          b.vx += (rotForceX - b.vx) * 0.15;
          b.vy += (rotForceY - b.vy) * 0.15 + (Math.random() - 0.48) * 1.5;
          b.vz += (Math.random() - 0.5) * 1.2;
        } else {
          // Caída natural por gravedad hacia el fondo de la esfera
          b.vy += gravity;
          b.vx *= 0.95;
          b.vz *= 0.95;
        }

        b.x += b.vx;
        b.y += b.vy;
        b.z += b.vz;

        // Choque con el límite de la esfera
        const dist = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z);
        const maxDist = SPHERE_RADIUS - BALL_RADIUS - 3;
        if (dist > maxDist) {
          const nx = b.x / dist;
          const ny = b.y / dist;
          const nz = b.z / dist;

          // Reposicionar en la superficie
          b.x = nx * maxDist;
          b.y = ny * maxDist;
          b.z = nz * maxDist;

          // Reflejar velocidad con amortiguación
          const dot = b.vx * nx + b.vy * ny + b.vz * nz;
          b.vx = (b.vx - 2 * dot * nx) * bounce;
          b.vy = (b.vy - 2 * dot * ny) * bounce;
          b.vz = (b.vz - 2 * dot * nz) * bounce;
        }
      }

      // Ordenar por Z para dibujar de atrás hacia adelante (Z-sorting)
      const sorted = [...balls].sort((a, b) => a.z - b.z);

      // Renderizar cada bolilla con sombreado esférico 3D y su número
      for (let i = 0; i < sorted.length; i++) {
        const b = sorted[i];

        // Escala según profundidad Z (-SPHERE_RADIUS a +SPHERE_RADIUS)
        const scale = 1 + b.z / (SPHERE_RADIUS * 2.5);
        const radius = BALL_RADIUS * scale;
        const px = centerX + b.x;
        const py = centerY + b.y;

        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, radius), 0, Math.PI * 2);

        // Gradiente radial 3D de la bolilla
        const grad = ctx.createRadialGradient(
          px - radius * 0.35,
          py - radius * 0.35,
          radius * 0.1,
          px,
          py,
          radius
        );
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, b.color);
        grad.addColorStop(1, "#020617");

        ctx.fillStyle = grad;
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 6;
        ctx.fill();

        // Círculo blanco central donde va el número (estilo bola de bingo/billar)
        const badgeRadius = radius * 0.58;
        ctx.beginPath();
        ctx.arc(px, py, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        // Texto con el número
        ctx.fillStyle = "#090d16";
        ctx.font = `900 ${Math.round(badgeRadius * 1.15)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(b.num), px, py + 0.5);

        ctx.restore();
      }

      // 5. Vidrio frontal de la esfera con brillos acrílicos curvos (brillo de alta definición)
      ctx.save();
      // Anillo exterior brillante
      ctx.beginPath();
      ctx.arc(centerX, centerY, SPHERE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Reflejo curvo superior izquierdo (Acrílico)
      ctx.beginPath();
      ctx.ellipse(
        centerX - SPHERE_RADIUS * 0.35,
        centerY - SPHERE_RADIUS * 0.4,
        SPHERE_RADIUS * 0.45,
        SPHERE_RADIUS * 0.22,
        -Math.PI / 5,
        0,
        Math.PI * 2
      );
      const glossGrad = ctx.createLinearGradient(
        centerX - SPHERE_RADIUS * 0.5,
        centerY - SPHERE_RADIUS * 0.6,
        centerX,
        centerY
      );
      glossGrad.addColorStop(0, "rgba(255, 255, 255, 0.55)");
      glossGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.15)");
      glossGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
      ctx.fillStyle = glossGrad;
      ctx.fill();

      // Reflejo secundario inferior derecho
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        SPHERE_RADIUS - 4,
        Math.PI * 0.15,
        Math.PI * 0.45
      );
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.restore();

      // 6. Tolva / Rampa de salida en la parte inferior
      ctx.save();
      const chuteX = centerX;
      const chuteY = centerY + SPHERE_RADIUS - 8;

      // Cuello de salida metálico
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(chuteX - 18, chuteY, 36, 32, [4, 4, 12, 12]);
      ctx.fill();
      ctx.stroke();

      // Orificio oscuro de caída
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.ellipse(chuteX, chuteY + 14, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // Loop continuo
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Función para Iniciar / Detener el giro
  const handleToggleSpin = () => {
    if (isSpinning) {
      // Detener con desaceleración suave
      setIsSpinning(false);
      setRotationSpeed(0.02);
    } else {
      // Arrancar a toda velocidad
      setIsSpinning(true);
      setRotationSpeed(0.18);
    }
  };

  // Función para sacar una bolilla con animación y sonido
  const handleExtractBall = () => {
    if (disabled || availableNumbers.length === 0) return;

    // Seleccionar aleatoriamente una de las bolillas disponibles
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const chosen = availableNumbers[randomIndex];

    // Acelerar la tómbola momentáneamente
    setIsSpinning(true);
    setRotationSpeed(0.28);

    // Animación de extracción: tras 1.2 segundos, sale la bolilla
    setTimeout(() => {
      setExtractingBall(chosen);
      setIsSpinning(false);
      setRotationSpeed(0.02);

      // Notificar al organizador para que se registre oficialmente
      onDrawBall(chosen);

      // Limpiar animación de extracción flotante tras 2 segundos
      setTimeout(() => {
        setExtractingBall(null);
      }, 2400);
    }, 1200);
  };

  // Estilo visual del último número salido
  const currentStyles = lastBall ? getBallStyles(lastBall) : null;

  // Lista de los últimos 10 números cantados
  const lastNumbersHistory = useMemo(() => {
    return [...drawnNumbers].reverse().slice(0, 10);
  }, [drawnNumbers]);

  return (
    <div className="w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-2 border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl overflow-hidden relative">
      {/* Resplandor decorativo de fondo */}
      <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cabecera Superior: Logo "GRAN BINGO" y Estado EN VIVO */}
      <div className="flex items-center justify-between gap-3 mb-4 relative z-10 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center font-black text-slate-950 shadow-lg text-lg">
            🎰
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 text-lg sm:text-xl tracking-wide uppercase">
                Bolillero Virtual 3D
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                Oficial
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Física real de rotación y extracción en vivo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 font-black text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
            EN VIVO
          </div>
        </div>
      </div>

      {/* Contenedor Principal: Tómbola 3D (Izquierda) + Panel Número Actual & Historial (Derecha) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
        {/* LADO IZQUIERDO: Canvas Esfera 3D + Controles de Giro */}
        <div className="md:col-span-7 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center w-full max-w-[340px] sm:max-w-[380px] aspect-square">
            {/* Soporte Trípode Metálico en CSS simulando la estructura */}
            <div className="absolute inset-x-8 bottom-3 h-8 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-800 rounded-full border-2 border-slate-500 shadow-2xl" />
            <div className="absolute bottom-6 w-32 h-6 bg-slate-900 border-2 border-slate-700 rounded-t-xl" />

            {/* Canvas 3D */}
            <canvas
              ref={canvasRef}
              width={340}
              height={340}
              className="relative z-10 drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)] max-w-full"
            />

            {/* Animación flotante de la bolilla saliendo por la tolva */}
            {extractingBall !== null && (
              <div className="absolute bottom-4 z-30 animate-bounce flex flex-col items-center">
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex flex-col items-center justify-center font-black shadow-[0_0_30px_rgba(255,255,255,0.7)] border-4 border-white transition-all transform scale-110"
                  style={{
                    backgroundColor: getBallStyles(extractingBall).color,
                    color: getBallStyles(extractingBall).textColor,
                  }}
                >
                  <span className="text-xs uppercase font-extrabold opacity-90 -mb-1">
                    {getBallStyles(extractingBall).letter}
                  </span>
                  <span className="text-2xl sm:text-3xl leading-none">
                    {extractingBall}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Barra de Controles: Girar / Detener y Extraer Bolilla */}
          <div className="w-full max-w-sm mt-3 flex items-center gap-3 bg-slate-950/90 border border-slate-800 p-2.5 rounded-2xl shadow-lg">
            <div className="flex-1 flex items-center gap-2 text-xs font-semibold text-slate-300 pl-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isSpinning
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-slate-500"
                }`}
              />
              <span className="truncate">
                {isSpinning ? "Tómbola girando..." : "Tómbola en reposo"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleSpin}
              className={`px-3 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                isSpinning
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-900/40"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
            >
              {isSpinning ? "⏹ Detener" : "🔄 Girar"}
            </button>

            <button
              type="button"
              onClick={handleExtractBall}
              disabled={disabled || availableNumbers.length === 0}
              className="px-4 py-2 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🎲 Sacar Bolilla
            </button>
          </div>
        </div>

        {/* LADO DERECHO: Tarjeta "NÚMERO ACTUAL" + Historial de Últimas Bolillas */}
        <div className="md:col-span-5 flex flex-col items-center bg-slate-950/80 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl w-full">
          <div className="text-center mb-3">
            <h3 className="text-xs sm:text-sm font-black tracking-widest text-slate-400 uppercase">
              Número Actual
            </h3>
          </div>

          {/* Gran Bolilla Central Estilo Casino */}
          <div className="relative my-2 flex items-center justify-center">
            {/* Anillos concéntricos de neón */}
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 border-blue-500/30 flex items-center justify-center animate-pulse">
              <div
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center font-black shadow-[0_15px_35px_rgba(0,0,0,0.7)] border-4 border-white/80 transition-all duration-300 transform hover:scale-105"
                style={{
                  backgroundColor: currentStyles?.color || "#1e293b",
                  backgroundImage: currentStyles
                    ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.7) 0%, ${currentStyles.color} 55%, #020617 100%)`
                    : undefined,
                }}
              >
                {lastBall ? (
                  <>
                    <span className="text-xs sm:text-sm font-black tracking-widest text-white/90 drop-shadow">
                      LETRA {currentStyles?.letter}
                    </span>
                    <span className="text-4xl sm:text-6xl font-black text-white drop-shadow-md leading-none my-0.5">
                      {lastBall}
                    </span>
                    <span className="text-[10px] font-bold text-white/80 tracking-wider">
                      {formatBall(lastBall)}
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-black text-slate-500">--</span>
                )}
              </div>
            </div>
          </div>

          {/* Badge ¡BINGO! */}
          <div className="mt-2 mb-4">
            <div className="px-6 py-1 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white font-black text-xs sm:text-sm tracking-widest shadow-lg shadow-blue-500/30 border border-blue-400">
              ¡BINGO OFICIAL!
            </div>
          </div>

          {/* Historial de Últimos Números */}
          <div className="w-full border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase mb-2">
              <span>Últimos Números</span>
              <span className="text-amber-400 font-black">
                {drawnNumbers.length} / 75
              </span>
            </div>

            {lastNumbersHistory.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2 italic">
                Aún no ha salido ninguna bolilla
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {lastNumbersHistory.map((num, idx) => {
                  const st = getBallStyles(num);
                  return (
                    <div
                      key={`${num}-${idx}`}
                      className={`h-9 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm border transition-all ${
                        idx === 0
                          ? "ring-2 ring-amber-400 scale-105 shadow-md"
                          : "opacity-85"
                      }`}
                      style={{
                        backgroundColor: st.color,
                        color: st.textColor,
                        borderColor: idx === 0 ? "#f59e0b" : "rgba(255,255,255,0.2)",
                      }}
                      title={`Bolilla ${st.letter}-${num}`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
