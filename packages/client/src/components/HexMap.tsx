import { useRef, useEffect, useState, useCallback } from "react";
import type { Tile, Faction } from "@xpoch/shared";
import { renderHexMap } from "./HexMapRenderer";

interface HexMapProps {
  readonly tiles: ReadonlyMap<string, Tile>;
  readonly factions: ReadonlyMap<string, Faction>;
}

const HEX_SIZE = 28;

export function HexMap({ tiles, factions }: HexMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    renderHexMap(ctx, tiles, factions, {
      hexSize: HEX_SIZE,
      offsetX: canvas.clientWidth / 2 + offset.x,
      offsetY: canvas.clientHeight / 2 + offset.y,
    });
  }, [tiles, factions, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setDragging(false);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
