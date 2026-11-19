"use client";
import { createContext, useContext } from "react";
import type { Geo } from "./frameGeo";

/** The layout the reels on this page use (set by <Machine geo>). */
export const GeoContext = createContext<Geo | null>(null);
export const useGeo = () => {
  const g = useContext(GeoContext);
  if (!g) throw new Error("Reel must be inside <Machine>");
  return g;
};
