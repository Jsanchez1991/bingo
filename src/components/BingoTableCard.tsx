"use client";

import React from "react";
import { TABLE_LETTERS } from "@/lib/bingo-patterns";

interface BingoTableCardProps {
  tableIndex: number;
  serialCode: string;
  grid: number[][];
  markedNumbers: number[];
  drawnBalls: number[];
  isActiveTable: boolean;
  isZoomed?: boolean;
  winningCells?: [number, number][];
  onSelectTable?: () => void;
  onToggleNumber?: (num: number) => void;
}

const HEADER_LETTERS = ["B", "I", "N", "G", "O"];

export default function BingoTableCard({
  tableIndex,
  serialCode,
  grid,
  markedNumbers,
  drawnBalls,
  isActiveTable,
  isZoomed = false,
  winningCells = [],
  onSelectTable,
  onToggleNumber,
}: BingoTableCardProps) {
  const markedSet = new Set(markedNumbers);
  const drawnSet = new Set(drawnBalls);
  const letterInfo = TABLE_LETTERS[tableIndex] || {
    letter: String(tableIndex),
    title: `Tabla #${tableIndex}`,
  };

  const isWinningCell = (r: number, c: number) =>
    winningCells.some(([wr, wc]) => wr === r && wc === c);

  let totalNumbersInTable = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (grid[r][c] > 0) totalNumbersInTable++;
    }
  }

  return (
    <div
      onClick={!isZoomed && onSelectTable ? onSelectTable : undefined}
      className={`print-table-card relative rounded-2xl border-2 transition-all select-none bg-white ${
        isZoomed
          ? "border-slate-900 shadow-2xl p-3 sm:p-5 max-w-lg mx-auto w-full"
          : isActiveTable
          ? "border-emerald-600 ring-4 ring-emerald-400/50 shadow-xl cursor-pointer hover:scale-[1.01] p-2.5 sm:p-3"
          : "border-slate-800 shadow-md cursor-pointer hover:border-slate-950 p-2.5 sm:p-3"
      }`}
    >
      {/* Cabecera superior de la Tabla (TABLA #1 + Letra correspondiente) */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <span
            className={`font-black tracking-tight text-slate-950 ${
              isZoomed ? "text-xl sm:text-2xl" : "text-xs sm:text-base"
            }`}
          >
            TABLA #{tableIndex}
          </span>
          <span
            className={`no-print inline-flex items-center px-2 py-0.5 rounded-md font-extrabold ${
              isActiveTable
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-amber-300"
            } ${isZoomed ? "text-sm sm:text-base" : "text-xs"}`}
          >
            {letterInfo.title}
          </span>
        </div>

        {isActiveTable && !isZoomed && (
          <span className="no-print inline-flex items-center gap-1 bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full animate-pulse border border-slate-900">
            ● EN JUEGO
          </span>
        )}

        {isZoomed && (
          <span className="font-mono font-bold text-sm text-slate-700">
            {markedNumbers.length} / {totalNumbersInTable} marcados
          </span>
        )}
      </div>

      {/* Cuadrícula clásica B - I - N - G - O */}
      <div className="border-2 border-slate-950 rounded-xl overflow-hidden bg-white">
        {/* Encabezado B I N G O */}
        <div className="grid grid-cols-5 border-b-2 border-slate-950 bg-slate-100">
          {HEADER_LETTERS.map((letter, idx) => (
            <div
              key={letter}
              className={`print-bingo-header-cell text-center font-black text-slate-950 border-r last:border-r-0 border-slate-900 ${
                isZoomed
                  ? "py-2 text-2xl sm:text-3xl"
                  : "py-1 text-lg sm:text-xl"
              } ${
                idx === tableIndex - 1
                  ? "bg-amber-300/70 underline decoration-2"
                  : ""
              }`}
            >
              {letter}
            </div>
          ))}
        </div>

        {/* 5 Filas x 5 Columnas */}
        <div className="divide-y-2 divide-slate-900">
          {grid.map((row, rIdx) => (
            <div
              key={rIdx}
              className="grid grid-cols-5 divide-x-2 divide-slate-900"
            >
              {row.map((num, cIdx) => {
                const isCenter = rIdx === 2 && cIdx === 2;
                const isEmptyBlank = !isCenter && num <= 0;

                // 1. Casilla central BINGO con el óvalo del código (ej. 00001-1)
                if (isCenter) {
                  return (
                    <div
                      key={cIdx}
                      className={`print-bingo-cell flex flex-col items-center justify-center bg-white text-slate-950 select-none ${
                        isZoomed ? "h-20 sm:h-24 p-1" : "h-12 sm:h-14 p-0.5"
                      }`}
                    >
                      <span
                        className={`font-black tracking-tighter leading-none text-slate-950 ${
                          isZoomed
                            ? "text-base sm:text-lg"
                            : "text-[10px] sm:text-xs"
                        }`}
                      >
                        BINGO
                      </span>
                      <span
                        className={`mt-0.5 border border-slate-900 rounded-full bg-white font-mono font-bold text-slate-900 leading-none ${
                          isZoomed
                            ? "px-2.5 py-1 text-xs sm:text-sm"
                            : "px-1.5 py-0.5 text-[8px] sm:text-[10px]"
                        }`}
                      >
                        {serialCode}
                      </span>
                    </div>
                  );
                }

                // 2. Casilla VACÍA EN BLANCO (las casillas que no forman parte de la letra B, I, N, G, O)
                if (isEmptyBlank) {
                  return (
                    <div
                      key={cIdx}
                      className={`print-bingo-cell bg-white select-none ${
                        isZoomed ? "h-20 sm:h-24" : "h-12 sm:h-14"
                      }`}
                    />
                  );
                }

                // 3. Casilla CON NÚMERO de la letra correspondiente (B, I, N, G, O o Tabla Llena)
                const isMarked = markedSet.has(num);
                const isOfficialBall = drawnSet.has(num);
                const isWinnerHighlight = isWinningCell(rIdx, cIdx);

                return (
                  <button
                    type="button"
                    key={cIdx}
                    onClick={(e) => {
                      if (isZoomed && onToggleNumber) {
                        e.stopPropagation();
                        onToggleNumber(num);
                      }
                    }}
                    className={`print-bingo-cell relative flex items-center justify-center font-black transition-all bg-white text-slate-950 ${
                      isZoomed
                        ? "h-20 sm:h-24 text-3xl sm:text-4xl cursor-pointer active:scale-95 hover:bg-amber-50"
                        : "h-12 sm:h-14 text-xl sm:text-2xl"
                    }`}
                  >
                    {/* Indicador discreto en modo Zoom si la bolilla ya salió en la cámara pero el jugador aún no la pinta */}
                    {isZoomed && isOfficialBall && !isMarked && (
                      <span
                        title="Este número ya salió en el sorteo"
                        className="no-print absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 ring-2 ring-white animate-bounce"
                      />
                    )}

                    {/* Ficha / Marcador pintado por el jugador */}
                    {isMarked && (
                      <span
                        className={`no-print absolute inset-1 sm:inset-1.5 rounded-full flex items-center justify-center shadow-inner transition-transform ${
                          isWinnerHighlight
                            ? "bg-emerald-500 text-white ring-4 ring-yellow-300"
                            : "bg-emerald-600 text-white border-2 border-emerald-950"
                        }`}
                      />
                    )}

                    {/* Número grande, nítido y legible tal como en el cartón ecuatoriano */}
                    <span
                      className={`relative z-10 leading-none ${
                        isMarked
                          ? "text-white print:text-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] print:drop-shadow-none"
                          : "text-slate-950"
                      }`}
                    >
                      {num}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Botón inferior en la vista de 6 tablas para abrir esta tabla en grande */}
      {!isZoomed && (
        <div className="mt-2 no-print">
          <div
            className={`w-full py-2 px-3 rounded-xl font-black text-center text-sm sm:text-base flex items-center justify-center gap-1.5 transition-colors ${
              isActiveTable
                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            <span>
              👆 Abrir Tabla #{tableIndex} ({letterInfo.title})
            </span>
            {markedNumbers.length > 0 && (
              <span className="bg-amber-400 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full">
                {markedNumbers.length}/{totalNumbersInTable}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
