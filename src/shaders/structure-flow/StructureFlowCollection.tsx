'use client';

import React, { lazy, Suspense } from "react";
import type { StructureFlowBackgroundProps } from "./StructureFlowBackground";

export const STRUCTURE_FLOW_VARIANTS = [
  "structure-flow",
] as const;

export type StructureFlowVariant = (typeof STRUCTURE_FLOW_VARIANTS)[number];

export type StructureFlowCollectionProps = StructureFlowBackgroundProps & {
  variant?: "structure-flow" | string;
};

const StructureVariant = lazy(() =>
  import("./StructureFlowBackground").then((module) => ({ default: module.StructureFlowBackground }))
);

const FALLBACK = <div className="threeui-background" style={{ background: "transparent" }} />;

export function StructureFlowCollection(props: StructureFlowCollectionProps) {
  const { variant: _variant, ...variantProps } = props;
  return (
    <Suspense fallback={FALLBACK}>
      <StructureVariant {...variantProps} />
    </Suspense>
  );
}
