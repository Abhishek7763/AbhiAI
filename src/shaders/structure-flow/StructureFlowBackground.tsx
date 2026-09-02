'use client';

import { useEffect, useRef } from "react";
import { createStructureFlowRenderer, STRUCTURE_FLOW_DEFAULTS, type StructureFlowOptions } from "./structureFlowRenderer";

export type StructureFlowBackgroundProps = Partial<StructureFlowOptions> & { className?: string };

export function StructureFlowBackground({ className = "", ...props }: StructureFlowBackgroundProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef<StructureFlowOptions>({ ...STRUCTURE_FLOW_DEFAULTS, ...props });

  useEffect(() => {
    optionsRef.current = { ...STRUCTURE_FLOW_DEFAULTS, ...props };
  }, [props]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const renderer = createStructureFlowRenderer(canvas, () => optionsRef.current);
    let frame = 0;
    let visible = true;

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height);
      renderer.render();
    };

    const tick = () => {
      renderer.render();
      frame = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible && !frame) frame = requestAnimationFrame(tick);
      if (!visible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });

    resizeObserver.observe(host);
    intersection.observe(host);
    resize();
    frame = requestAnimationFrame(tick);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      renderer.dispose();
    };
  }, []);

  const maskStart = props.maskStart ?? STRUCTURE_FLOW_DEFAULTS.maskStart;
  const maskSolid = props.maskSolid ?? STRUCTURE_FLOW_DEFAULTS.maskSolid;
  const mask = `linear-gradient(to bottom, transparent ${maskStart * 100}%, black ${maskSolid * 100}%, black 100%)`;

  return (
    <div
      ref={hostRef}
      className={`threeui-background structure-flow${className ? ` ${className}` : ""}`}
      style={{ opacity: 0.85, WebkitMaskImage: mask, maskImage: mask }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
