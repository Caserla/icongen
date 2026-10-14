import { z } from "zod";
import { compileGeometryPaths, svgGeometryPlanSchema, type SvgGeometryPlan } from "./svg-geometry-plan";
import { validateGeneratedSvg } from "./validate-generated-svg";

export const doodleRolesSchema = z.record(z.string().regex(/^[a-z][a-z0-9-]*$/),
  z.enum(["contour", "opening", "thin-attachment", "surface-mark", "accent"]));
export type DoodleRoles = z.infer<typeof doodleRolesSchema>;

/** Production SVG authoring from semantic open strokes, not model paint. */
export function renderDoodleGeometry(geometry: SvgGeometryPlan | undefined, rawRoles: unknown, ink: string, accent: string, idPrefix: string) {
  if (!geometry) throw new Error("Doodle candidate requires executable geometry");
  const roles = doodleRolesSchema.parse(rawRoles);
  const ids = new Set(geometry.paths.map(path => path.id));
  if (Object.keys(roles).length !== ids.size || Object.keys(roles).some(id => !ids.has(id))) throw new Error("Every doodle geometry path needs one semantic role");
  if (!/^#[0-9a-f]{6}$/i.test(ink) || !/^#[0-9a-f]{6}$/i.test(accent)) throw new Error("Doodle candidate requires frozen paints");
  const count = (role: DoodleRoles[string]) => geometry.paths.filter(path => roles[path.id] === role).length;
  if (count("contour") < 1 || count("surface-mark") > 3 || count("accent") > 2) throw new Error("Doodle contour/detail balance is invalid");
  // Hand-drawn character belongs in authored paths. A post-render coordinate warp
  // changes the object's proportions and previously twisted circular lenses.
  const paths = compileGeometryPaths(geometry);
  const attachments = geometry.paths.filter(path => roles[path.id] === "thin-attachment");
  const occlusionId = `${idPrefix}-attachment-occlusion`;
  const occlusion = attachments.length
    ? `<defs><mask id="${occlusionId}" maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32"><rect x="-4" y="-4" width="32" height="32" fill="white"/>${attachments.map(path => `<path d="${paths.get(path.id)}Z" fill="black"/>`).join("")}</mask></defs>`
    : "";
  let body = "";
  let contourIndex = 0;
  for (const path of geometry.paths) {
    const role = roles[path.id];
    const d = paths.get(path.id)!;
    if (role === "thin-attachment" && (path.join === "closed" || path.commands.at(-1)?.[0] === "Z" || path.repeat)) {
      throw new Error("Thin doodle attachments must be one open centerline, never a double-outline loop");
    }
    if (["surface-mark", "accent"].includes(role) && (d.match(/M/g) ?? []).length > 1) {
      throw new Error("One optional doodle mark may not hide a repeated grid");
    }
    const color = role === "accent" ? accent : ink;
    const width = role === "accent" ? 1.15 : role === "contour" && count("contour") > 1
      ? [1.24, 1.34, 1.2, 1.3][contourIndex++ % 4] : 1.3;
    body += `<path id="${idPrefix}-${path.id}" data-part-role="${role}" d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${role === "contour" && occlusion ? ` mask="url(#${occlusionId})"` : ""}/>`;
  }
  return validateGeneratedSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">${occlusion}${body}</svg>`);
}
