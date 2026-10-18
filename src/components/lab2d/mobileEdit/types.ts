/**
 * CALDRA CHAMFER — TIPOS DO SISTEMA DE EDIÇÃO CONTEXTUAL MOBILE
 */

import type { Entity } from "@/lib/lab2d/core";

export type PropertyUnit = "mm" | "°" | "cm" | "m" | "un" | "";

export interface NumericPropertyDef {
  key: string;
  label: string;
  symbol?: string; // Ex: "Ø", "R", "L", "↔", "↕", "X", "Y", "∠"
  value: number;
  unit: PropertyUnit;
  min?: number;
  max?: number;
  defaultStep?: number;
  stepOptions?: number[]; // Padrão: [0.1, 1, 5, 10]
  decimals?: number;
  allowNegative?: boolean;
}

export interface TextPropertyDef {
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
}

export interface SelectPropertyDef {
  key: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}

export type EntityProperty =
  | { type: "numeric"; def: NumericPropertyDef }
  | { type: "text"; def: TextPropertyDef }
  | { type: "select"; def: SelectPropertyDef };

export interface EntityPropertySet {
  entityId: string;
  entityType: Entity["type"] | "rectangle" | "sheet" | "project";
  title: string;
  layer: string;
  properties: EntityProperty[];
}
