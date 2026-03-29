/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { prepareWithSegments, layoutWithLines } from './pretext/layout.ts';
import {
  initAudio,
  startMusic,
  stopMusic,
  playPaddleBounce,
  playBrickExplosion,
  playWallBounce,
  playLoseLife,
  playGameOver,
  playWin,
} from './audio.ts';

const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 10;
const BALL_RADIUS = 6;
const BASE_FONT_SIZE = 32;
const BASE_LINE_HEIGHT = 40;
const BASE_WIDTH = 800; // Reference width for scaling
const BG_FONT = '14px monospace';

const COLORS = {
  bg: '#FFF900',
  bgText: '#E6E000', // Different shade of yellow for background text
  accent: '#FF004F',
  text: '#000000',
};

const TEXT_PARAGRAPH = `Pretext turns motion into language and lets every measured word swing into place while you break the sentence. It is a text layout engine that allows you to measure and layout text without touching the DOM. This makes it incredibly fast and suitable for games, animations, and custom text rendering.`;

const BG_TEXT_PARAGRAPH = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. `.repeat(20);

type Brick = {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  active: boolean;
};

type BgWord = {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  targetX: number;
  targetY: number;
  text: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  text: string;
  life: number;
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover' | 'won'>('start');

  // Use refs for game state to avoid re-running useEffect
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const gameStateRef = useRef<'start' | 'playing' | 'gameover' | 'won'>('start');

  // Sync state to ref
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mutable canvas dimensions that track the screen
    let cw = window.innerWidth;
    let ch = window.innerHeight;
    let bottomInset = 0; // safe area inset for mobile browser nav

    // Dynamic font sizing based on canvas width
    let fontSize = BASE_FONT_SIZE;
    let lineHeight = BASE_LINE_HEIGHT;
    let font = `bold ${fontSize}px monospace`;

    const updateFontSize = () => {
      const scale = Math.max(0.5, Math.min(1.5, cw / BASE_WIDTH));
      fontSize = Math.round(BASE_FONT_SIZE * scale);
      lineHeight = Math.round(BASE_LINE_HEIGHT * scale);
      font = `bold ${fontSize}px monospace`;
    };

    // Prepare text measurements (font-dependent, re-prepared on resize)
    let prepared = prepareWithSegments(TEXT_PARAGRAPH, font);
    const bgPrepared = prepareWithSegments(BG_TEXT_PARAGRAPH, BG_FONT);

    let bricks: Brick[] = [];
    let bgWords: BgWord[] = [];
    let particles: Particle[] = [];
    let startBtnHover = false;
    let startBtnPressed = false;

    const initBgWords = () => {
      bgWords = [];
      const bgLayout = layoutWithLines(bgPrepared, cw - 40, 18);
      let bgStartY = 20;
      for (const line of bgLayout.lines) {
        let currentX = 20;
        for (let i = line.start.segmentIndex; i < line.end.segmentIndex; i++) {
          const segmentText = bgPrepared.segments[i];
          const segmentWidth = bgPrepared.widths[i];
          if (segmentText.trim().length > 0) {
            bgWords.push({
              x: currentX,
              y: bgStartY,
              originalX: currentX,
              originalY: bgStartY,
              targetX: currentX,
              targetY: bgStartY,
              text: segmentText,
            });
          }
          currentX += segmentWidth;
        }
        bgStartY += 18;
      }
    };

    const initBricks = () => {
      bricks = [];
      particles = [];
      updateFontSize();
      prepared = prepareWithSegments(TEXT_PARAGRAPH, font);
      const layout = layoutWithLines(prepared, cw - 100, lineHeight);
      let startY = 80;
      for (const line of layout.lines) {
        let currentX = (cw - line.width) / 2;
        for (let i = line.start.segmentIndex; i < line.end.segmentIndex; i++) {
          const segmentText = prepared.segments[i];
          const segmentWidth = prepared.widths[i];
          if (segmentText.trim().length > 0) {
            bricks.push({
              x: currentX,
              y: startY,
              width: segmentWidth,
              height: lineHeight,
              text: segmentText,
              active: true,
            });
          }
          currentX += segmentWidth;
        }
        startY += lineHeight;
      }
    };

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;

      // Use the smallest reported height to avoid content behind browser chrome.
      // window.innerHeight on iOS includes area behind bottom bar,
      // but document.documentElement.clientHeight respects actual CSS viewport.
      // visualViewport.height is accurate when available and the page isn't zoomed.
      const vv = window.visualViewport;
      const candidates = [window.innerHeight, document.documentElement.clientHeight];
      if (vv) candidates.push(vv.height);
      cw = vv ? vv.width : window.innerWidth;
      ch = Math.min(...candidates);

      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Read safe-area-inset-bottom (notch / home indicator)
      const sabStr = getComputedStyle(document.documentElement).getPropertyValue('--sab').trim();
      bottomInset = parseFloat(sabStr) || 0;

      // Re-layout background words for new width
      initBgWords();

      // Re-layout bricks only if not currently playing (don't disrupt active game)
      if (gameStateRef.current !== 'playing') {
        initBricks();
      }

      // Reposition paddle above bottom safe area
      paddle.y = ch - bottomInset - 40;
      paddle.x = Math.min(paddle.x, cw - paddle.width);
    };

    const initAll = () => {
      resizeCanvas();
      initBricks();
    };

    let paddle = {
      x: cw / 2 - PADDLE_WIDTH / 2,
      y: ch - bottomInset - 40,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      vx: 0,
    };

    let ball = {
      x: cw / 2,
      y: ch - bottomInset - 60,
      vx: 1.5,
      vy: -1.5,
      radius: BALL_RADIUS,
      history: [] as {x: number, y: number, r: number}[],
    };

    initAll();

    let animationId: number;
    let isLeftPressed = false;
    let isRightPressed = false;

    // Start button geometry helpers (always computed from current cw/ch)
    const btnX = () => cw / 2;
    const btnY = () => ch / 2 + 60;
    const BTN_RADIUS = 50;

    const isInsideStartBtn = (cx: number, cy: number) => {
      const dx = cx - btnX();
      const dy = cy - btnY();
      return dx * dx + dy * dy <= BTN_RADIUS * BTN_RADIUS;
    };

    const startGame = () => {
      if (gameStateRef.current === 'playing') return;
      initAudio();
      const wasOver = gameStateRef.current === 'gameover' || gameStateRef.current === 'won';
      setGameState('playing');
      startMusic();
      if (wasOver) {
        initBricks();
        scoreRef.current = 0;
        livesRef.current = 3;
        ball.x = cw / 2;
        ball.y = ch - bottomInset - 60;
        ball.vx = 1.5;
        ball.vy = -1.5;
        ball.history = [];
        paddle.x = cw / 2 - PADDLE_WIDTH / 2;
        paddle.y = ch - bottomInset - 40;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') isLeftPressed = true;
      if (e.key === 'ArrowRight') isRightPressed = true;
      if (e.key === ' ') {
        startGame();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') isLeftPressed = false;
      if (e.key === 'ArrowRight') isRightPressed = false;
    };

    // Helper to convert screen coordinates to canvas coordinates
    const screenToCanvas = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * cw,
        y: ((clientY - rect.top) / rect.height) * ch,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      if (gameStateRef.current === 'playing') {
        canvas.style.cursor = 'none';
        paddle.x = Math.max(0, Math.min(x - paddle.width / 2, cw - paddle.width));
      } else {
        startBtnHover = isInsideStartBtn(x, y);
        canvas.style.cursor = startBtnHover ? 'pointer' : 'default';
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (gameStateRef.current === 'playing') return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      if (isInsideStartBtn(x, y)) {
        startGame();
      }
    };

    // Touch support for mobile
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (gameStateRef.current !== 'playing') return;
      const touch = e.touches[0];
      const { x } = screenToCanvas(touch.clientX, touch.clientY);
      paddle.x = Math.max(0, Math.min(x - paddle.width / 2, cw - paddle.width));
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = screenToCanvas(touch.clientX, touch.clientY);
      if (gameStateRef.current !== 'playing') {
        if (isInsideStartBtn(x, y)) {
          startBtnPressed = true;
          startGame();
        }
      } else {
        paddle.x = Math.max(0, Math.min(x - paddle.width / 2, cw - paddle.width));
      }
    };

    const handleTouchEnd = () => {
      startBtnPressed = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', resizeCanvas);
    window.visualViewport?.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    const update = () => {
      if (gameStateRef.current !== 'playing') return;

      // Move paddle
      if (isLeftPressed) paddle.x -= 7;
      if (isRightPressed) paddle.x += 7;

      const BORDER = 4;
      paddle.x = Math.max(BORDER, Math.min(paddle.x, cw - paddle.width - BORDER));

      // Record ball history for tail (sputtering effect)
      if (Math.random() > 0.3) {
        ball.history.push({
          x: ball.x + (Math.random() - 0.5) * 8,
          y: ball.y + (Math.random() - 0.5) * 8,
          r: ball.radius * (0.5 + Math.random() * 0.8)
        });
      }
      if (ball.history.length > 15) {
        ball.history.shift();
      }

      // Move ball
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Wall collisions
      if (ball.x - ball.radius < BORDER) {
        ball.x = ball.radius + BORDER;
        ball.vx = -ball.vx;
        playWallBounce();
      } else if (ball.x + ball.radius > cw - BORDER) {
        ball.x = cw - ball.radius - BORDER;
        ball.vx = -ball.vx;
        playWallBounce();
      }
      if (ball.y - ball.radius < BORDER) {
        ball.y = ball.radius + BORDER;
        ball.vy = -ball.vy;
        playWallBounce();
      }

      // Bottom collision (lose life) — above the safe area
      if (ball.y + ball.radius > ch - bottomInset) {
        livesRef.current -= 1;
        if (livesRef.current <= 0) {
          setGameState('gameover');
          stopMusic();
          playGameOver();
        } else {
          playLoseLife();
          // Reset ball
          ball.x = paddle.x + paddle.width / 2;
          ball.y = paddle.y - ball.radius - 5;
          ball.vx = 1.5 * (Math.random() > 0.5 ? 1 : -1);
          ball.vy = -1.5;
          ball.history = [];
        }
      }

      // Paddle collision
      if (
        ball.vy > 0 && // Only bounce if falling
        ball.y + ball.radius > paddle.y &&
        ball.y - ball.radius < paddle.y + paddle.height &&
        ball.x + ball.radius > paddle.x &&
        ball.x - ball.radius < paddle.x + paddle.width
      ) {
        ball.vy = -Math.abs(ball.vy);
        ball.y = paddle.y - ball.radius; // Prevent sticking
        playPaddleBounce();
        // Add some english based on where it hit the paddle
        const hitPoint = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
        ball.vx = hitPoint * 2.5; // Max horizontal speed

        // Ensure minimum vertical speed so it doesn't bounce horizontally forever
        if (Math.abs(ball.vy) < 1) {
            ball.vy = -1;
        }
      }

      // Brick collision
      let activeBricks = 0;
      let hitBrick = false;

      for (const brick of bricks) {
        if (!brick.active) continue;
        activeBricks++;

        if (!hitBrick) {
          // Simple AABB collision
          if (
            ball.x + ball.radius > brick.x &&
            ball.x - ball.radius < brick.x + brick.width &&
            ball.y + ball.radius > brick.y - brick.height &&
            ball.y - ball.radius < brick.y
          ) {
            brick.active = false;
            hitBrick = true;

            // Determine bounce direction based on overlap
            const overlapLeft = (ball.x + ball.radius) - brick.x;
            const overlapRight = (brick.x + brick.width) - (ball.x - ball.radius);
            const overlapTop = (ball.y + ball.radius) - (brick.y - brick.height);
            const overlapBottom = brick.y - (ball.y - ball.radius);

            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

            if (minOverlap === overlapTop || minOverlap === overlapBottom) {
              ball.vy = -ball.vy;
            } else {
              ball.vx = -ball.vx;
            }

            scoreRef.current += 10;
            playBrickExplosion();

            // Create explosion particles
            for (let i = 0; i < brick.text.length; i++) {
              particles.push({
                x: brick.x + (i * (brick.width / brick.text.length)),
                y: brick.y,
                vx: (Math.random() - 0.5) * 8 + ball.vx * 0.5,
                vy: (Math.random() - 0.5) * 8 + ball.vy * 0.5,
                rotation: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.4,
                text: brick.text[i],
                life: 1.0,
              });
            }
          }
        }
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.rotation += p.vr;
        p.life -= 0.02;
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }

      // Update background words (displacement)
      for (const bgWord of bgWords) {
        const dx = bgWord.x - ball.x;
        // Adjust y since text is drawn from bottom
        const dy = (bgWord.y - 9) - ball.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 80;

        if (dist < maxDist) {
          const force = (maxDist - dist) / maxDist;
          // Push away from ball
          bgWord.targetX = bgWord.originalX + (dx / dist) * force * 30;
          bgWord.targetY = bgWord.originalY + (dy / dist) * force * 30;
        } else {
          // Return to original position
          bgWord.targetX = bgWord.originalX;
          bgWord.targetY = bgWord.originalY;
        }

        // Spring physics for smooth return
        bgWord.x += (bgWord.targetX - bgWord.x) * 0.15;
        bgWord.y += (bgWord.targetY - bgWord.y) * 0.15;
      }

      if (activeBricks === 0 && !hitBrick) {
        setGameState('won');
        stopMusic();
        playWin();
      }
    };

    const draw = () => {
      // Clear background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, cw, ch);

      // Draw background text
      ctx.font = BG_FONT;
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = COLORS.bgText;
      for (const bgWord of bgWords) {
        ctx.fillText(bgWord.text, bgWord.x, bgWord.y);
      }

      // Draw border (bottom edge raised above safe area)
      const playAreaBottom = ch - bottomInset;
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, cw - 4, playAreaBottom - 4);

      // Fill safe area below play area with background
      if (bottomInset > 0) {
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, playAreaBottom, cw, bottomInset);
      }

      // Draw bricks (text)
      ctx.font = font;
      ctx.textBaseline = 'bottom';
      for (const brick of bricks) {
        if (brick.active) {
          ctx.fillStyle = COLORS.text;
          ctx.fillText(brick.text, brick.x, brick.y);
        }
      }

      // Draw particles
      ctx.font = font;
      for (const p of particles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = COLORS.text;
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      }

      // Draw paddle (pill / rounded rectangle)
      ctx.fillStyle = COLORS.accent;
      const pRadius = paddle.height / 2;
      ctx.beginPath();
      ctx.moveTo(paddle.x + pRadius, paddle.y);
      ctx.lineTo(paddle.x + paddle.width - pRadius, paddle.y);
      ctx.arc(paddle.x + paddle.width - pRadius, paddle.y + pRadius, pRadius, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(paddle.x + pRadius, paddle.y + paddle.height);
      ctx.arc(paddle.x + pRadius, paddle.y + pRadius, pRadius, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();

      // Draw ball tail
      for (let i = 0; i < ball.history.length; i++) {
        const point = ball.history[i];
        const progress = i / ball.history.length;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.r * progress, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 0, 79, ${progress * 0.8})`; // Fade out tail
        ctx.fill();
        ctx.closePath();
      }

      // Draw ball
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.accent;
      ctx.fill();
      ctx.closePath();

      // Draw UI
      ctx.fillStyle = COLORS.accent;
      ctx.font = 'bold 20px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(`SCORE: ${scoreRef.current}`, 20, 20);
      ctx.fillText(`LIVES: ${'♥'.repeat(livesRef.current)}`, cw - 150, 20);

      // Draw start button helper
      const drawStartButton = (label: string, subtitle: string) => {
        ctx.fillStyle = 'rgba(255, 249, 0, 0.85)';
        ctx.fillRect(0, 0, cw, ch);

        // Title
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 40px monospace';
        ctx.fillText(label, cw / 2, ch / 2 - 50);

        const bx = btnX();
        const by = btnY();

        // Button shadow
        ctx.beginPath();
        ctx.arc(bx, by + 4, BTN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 0, 40, 0.5)';
        ctx.fill();

        // Button body
        const btnScale = startBtnPressed ? 0.92 : startBtnHover ? 1.05 : 1;
        const r = BTN_RADIUS * btnScale;
        const gradient = ctx.createRadialGradient(
          bx - r * 0.3, by - r * 0.3, r * 0.1,
          bx, by, r,
        );
        gradient.addColorStop(0, '#FF3366');
        gradient.addColorStop(0.7, '#FF004F');
        gradient.addColorStop(1, '#CC003F');
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Button highlight
        ctx.beginPath();
        ctx.arc(bx - r * 0.2, by - r * 0.2, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();

        // Play triangle
        const triSize = r * 0.45;
        ctx.beginPath();
        ctx.moveTo(bx - triSize * 0.4, by - triSize * 0.6);
        ctx.lineTo(bx - triSize * 0.4, by + triSize * 0.6);
        ctx.lineTo(bx + triSize * 0.6, by);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Subtitle below button
        ctx.fillStyle = COLORS.text;
        ctx.font = 'bold 16px monospace';
        ctx.fillText(subtitle, cw / 2, by + BTN_RADIUS + 30);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
      };

      if (gameStateRef.current === 'start') {
        drawStartButton('PRETEXT BREAKER', 'Tap or press SPACE');
      } else if (gameStateRef.current === 'gameover') {
        drawStartButton('GAME OVER', 'Tap to Restart');
      } else if (gameStateRef.current === 'won') {
        drawStartButton('YOU WIN!', 'Tap to Play Again');
      }
    };

    const loop = () => {
      update();
      draw();
      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', resizeCanvas);
      window.visualViewport?.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <div
      className="overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.bg,
      }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: COLORS.bg,
          touchAction: 'none',
        }}
      />
    </div>
  );
}
