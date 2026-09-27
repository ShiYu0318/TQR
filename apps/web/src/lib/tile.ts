import data from "../../../../data/tile.json";

/** The QQR five-view egg-crate demo: two filament box lists and the five links it carries (fixed data). */
export interface TileData {
  /** voxel size in modules */
  vox: number;
  dims: [number, number, number];
  /** boxes as flat [x0, y0, z0, x1, y1, z1, ...] in voxels */
  white: number[];
  black: number[];
  links: Record<"T" | "N" | "E" | "S" | "W", string>;
}

export const TILE = data.tile as unknown as TileData;
