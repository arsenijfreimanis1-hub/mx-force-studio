"use client";

import * as THREE from "three";

type GarageTextures = {
  grass: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
  rock: THREE.CanvasTexture;
  rockTile: THREE.CanvasTexture;
  diamond: THREE.CanvasTexture;
  brushed: THREE.CanvasTexture;
  paint: THREE.CanvasTexture;
  leather: THREE.CanvasTexture;
  cloud: THREE.CanvasTexture;
};

let cache: GarageTextures | null = null;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number, rand: () => number) => void,
  seed: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not paint a garage texture.");
  paint(ctx, size, rng(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function speck(ctx: CanvasRenderingContext2D, rand: () => number, size: number, count: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const r = 0.4 + rand() * 2.2;
    ctx.globalAlpha = 0.15 + rand() * 0.55;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function paintGrass(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  ctx.fillStyle = "#3e6a34";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = rand() > 0.5 ? "#4f7d3c" : "#2f5228";
    ctx.globalAlpha = 0.28 + rand() * 0.35;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 6 + rand() * 16, 4 + rand() * 9, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  speck(ctx, rand, size, 1400, "#1d3318");
  speck(ctx, rand, size, 700, "#c3b48a");
  ctx.strokeStyle = "rgba(28, 56, 22, 0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 4, y - 4 - rand() * 7);
    ctx.stroke();
  }
}

function paintDirt(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  ctx.fillStyle = "#6a4a32";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = rand() > 0.5 ? "#7b5a3c" : "#4e3424";
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 12 + rand() * 40, 8 + rand() * 20, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  speck(ctx, rand, size, 900, "#2a1a12");
  speck(ctx, rand, size, 400, "#c4b49a");
}

function paintRock(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  ctx.fillStyle = "#6d655c";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = rand() > 0.45 ? "#857b70" : "#4e4842";
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 16 + rand() * 50, 10 + rand() * 28, rand() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(30, 26, 22, 0.45)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    let x = rand() * size;
    let y = rand() * size;
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rand() - 0.5) * 80;
      y += (rand() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  speck(ctx, rand, size, 500, "#2c2824");
  speck(ctx, rand, size, 180, "#8a9a78");
}

function paintDiamond(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  ctx.fillStyle = "#3c424a";
  ctx.fillRect(0, 0, size, size);
  speck(ctx, rand, size, 600, "#22262b");
  const step = 36;
  for (let y = 0; y < size + step; y += step) {
    for (let x = 0; x < size + step; x += step) {
      const ox = (y / step) % 2 === 0 ? 0 : step / 2;
      ctx.beginPath();
      ctx.moveTo(x + ox, y + 4);
      ctx.lineTo(x + ox + 8, y + 10);
      ctx.lineTo(x + ox, y + 16);
      ctx.lineTo(x + ox - 8, y + 10);
      ctx.closePath();
      ctx.fillStyle = "rgba(230, 236, 242, 0.22)";
      ctx.fill();
      ctx.strokeStyle = "rgba(16, 18, 22, 0.35)";
      ctx.stroke();
    }
  }
}

function paintBrushed(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "#d5dbe2");
  g.addColorStop(1, "#b7c0c9");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.02 + rand() * 0.08})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rand() - 0.5) * 2);
    ctx.stroke();
  }
  speck(ctx, rand, size, 200, "#6d7680");
}

function paintNoise(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  ctx.fillStyle = "#c8c2ba";
  ctx.fillRect(0, 0, size, size);
  speck(ctx, rand, size, 1600, "#5c564e");
  speck(ctx, rand, size, 800, "#f4f0ea");
}

function paintLeather(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  ctx.fillStyle = "#1c2430";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(80, 96, 112, ${0.15 + rand() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 20 + rand() * 50, 8 + rand() * 16, rand() * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  speck(ctx, rand, size, 400, "#0b1016");
}

function paintCloud(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 8; i++) {
    const x = size * (0.3 + rand() * 0.4);
    const y = size * (0.35 + rand() * 0.3);
    const grd = ctx.createRadialGradient(x, y, 4, x, y, 28 + rand() * 36);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, 40 + rand() * 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function garageTextures(): GarageTextures {
  if (cache) return cache;
  if (typeof document === "undefined") {
    throw new Error("Garage textures are painted in the browser.");
  }
  const rock = canvasTexture(512, paintRock, 11);
  const rockTile = rock.clone();
  rockTile.repeat.set(4, 1.4);
  rockTile.needsUpdate = true;
  cache = {
    grass: canvasTexture(1024, paintGrass, 3),
    dirt: canvasTexture(512, paintDirt, 7),
    rock,
    rockTile,
    diamond: canvasTexture(512, paintDiamond, 5),
    brushed: canvasTexture(256, paintBrushed, 9),
    paint: canvasTexture(256, paintNoise, 13),
    leather: canvasTexture(256, paintLeather, 17),
    cloud: canvasTexture(256, paintCloud, 19),
  };
  cache.cloud.format = THREE.RGBAFormat;
  return cache;
}
