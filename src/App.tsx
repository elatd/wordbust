/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { prepareWithSegments, layoutWithLines } from './pretext/layout.ts';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 10;
const BALL_RADIUS = 6;
const LINE_HEIGHT = 40;
const FONT = 'bold 32px monospace';
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

    // Prepare foreground text
    const prepared = prepareWithSegments(TEXT_PARAGRAPH, FONT);
    const layout = layoutWithLines(prepared, CANVAS_WIDTH - 100, LINE_HEIGHT);

    // Prepare background text
    const bgPrepared = prepareWithSegments(BG_TEXT_PARAGRAPH, BG_FONT);
    const bgLayout = layoutWithLines(bgPrepared, CANVAS_WIDTH - 40, 18);

    let bricks: Brick[] = [];
    let bgWords: BgWord[] = [];
    let particles: Particle[] = [];
    
    // Initialize background words
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

    const initBricks = () => {
      bricks = [];
      particles = [];
      let startY = 80;
      for (const line of layout.lines) {
        let currentX = (CANVAS_WIDTH - line.width) / 2;
        for (let i = line.start.segmentIndex; i < line.end.segmentIndex; i++) {
          const segmentText = prepared.segments[i];
          const segmentWidth = prepared.widths[i];
          if (segmentText.trim().length > 0) {
            bricks.push({
              x: currentX,
              y: startY,
              width: segmentWidth,
              height: LINE_HEIGHT,
              text: segmentText,
              active: true,
            });
          }
          currentX += segmentWidth;
        }
        startY += LINE_HEIGHT;
      }
    };
    
    initBricks();

    let paddle = {
      x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
      y: CANVAS_HEIGHT - 40,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      vx: 0,
    };

    let ball = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 60,
      vx: 1.5, // Slower ball
      vy: -1.5,
      radius: BALL_RADIUS,
      history: [] as {x: number, y: number, r: number}[],
    };

    let animationId: number;
    let isLeftPressed = false;
    let isRightPressed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') isLeftPressed = true;
      if (e.key === 'ArrowRight') isRightPressed = true;
      if (e.key === ' ' && gameStateRef.current !== 'playing') {
        setGameState('playing');
        if (gameStateRef.current === 'gameover' || gameStateRef.current === 'won') {
          // Reset game
          initBricks();
          scoreRef.current = 0;
          livesRef.current = 3;
          ball.x = CANVAS_WIDTH / 2;
          ball.y = CANVAS_HEIGHT - 60;
          ball.vx = 1.5;
          ball.vy = -1.5;
          ball.history = [];
          paddle.x = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') isLeftPressed = false;
      if (e.key === 'ArrowRight') isRightPressed = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      paddle.x = Math.max(0, Math.min(mouseX - paddle.width / 2, CANVAS_WIDTH - paddle.width));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);

    const update = () => {
      if (gameStateRef.current !== 'playing') return;

      // Move paddle
      if (isLeftPressed) paddle.x -= 7;
      if (isRightPressed) paddle.x += 7;
      
      const BORDER = 4;
      paddle.x = Math.max(BORDER, Math.min(paddle.x, CANVAS_WIDTH - paddle.width - BORDER));

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
      } else if (ball.x + ball.radius > CANVAS_WIDTH - BORDER) {
        ball.x = CANVAS_WIDTH - ball.radius - BORDER;
        ball.vx = -ball.vx;
      }
      if (ball.y - ball.radius < BORDER) {
        ball.y = ball.radius + BORDER;
        ball.vy = -ball.vy;
      }

      // Bottom collision (lose life)
      if (ball.y + ball.radius > CANVAS_HEIGHT) {
        livesRef.current -= 1;
        if (livesRef.current <= 0) {
          setGameState('gameover');
        } else {
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
      }
    };

    const draw = () => {
      // Clear background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw background text
      ctx.font = BG_FONT;
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = COLORS.bgText;
      for (const bgWord of bgWords) {
        ctx.fillText(bgWord.text, bgWord.x, bgWord.y);
      }

      // Draw border
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, CANVAS_WIDTH - 4, CANVAS_HEIGHT - 4);

      // Draw bricks (text)
      ctx.font = FONT;
      ctx.textBaseline = 'bottom';
      for (const brick of bricks) {
        if (brick.active) {
          ctx.fillStyle = COLORS.text;
          ctx.fillText(brick.text, brick.x, brick.y);
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = COLORS.text;
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      }

      // Draw paddle
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

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
      ctx.fillText(`LIVES: ${'♥'.repeat(livesRef.current)}`, CANVAS_WIDTH - 150, 20);

      if (gameStateRef.current === 'start') {
        ctx.fillStyle = 'rgba(255, 249, 0, 0.8)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px monospace';
        ctx.fillText('PRETEXT BREAKER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
        ctx.font = 'bold 20px monospace';
        ctx.fillText('Press SPACE to Start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
        ctx.textAlign = 'left';
      } else if (gameStateRef.current === 'gameover') {
        ctx.fillStyle = 'rgba(255, 249, 0, 0.8)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px monospace';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
        ctx.font = 'bold 20px monospace';
        ctx.fillText('Press SPACE to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
        ctx.textAlign = 'left';
      } else if (gameStateRef.current === 'won') {
        ctx.fillStyle = 'rgba(255, 249, 0, 0.8)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px monospace';
        ctx.fillText('YOU WIN!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
        ctx.font = 'bold 20px monospace';
        ctx.fillText('Press SPACE to Play Again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
        ctx.textAlign = 'left';
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
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
      <div className="relative shadow-2xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block max-w-full h-auto cursor-none"
          style={{ backgroundColor: COLORS.bg }}
        />
      </div>
    </div>
  );
}
