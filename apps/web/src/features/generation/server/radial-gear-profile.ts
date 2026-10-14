import { svgGeometryPlanSchema, type SvgGeometryPlan } from "./svg-geometry-plan";

type Point = [number, number];
const rounded = (value: number) => Math.round(value * 1e5) / 1e5;

/** One geometric tooth/valley unit. The profile is semantic gear geometry, not a style paint. */
export function radialGearPath(input: {
  id: string; center: Point; count: number; rootRadius: number; tipRadius: number;
}): SvgGeometryPlan["paths"][number] {
  const { id, center, count, rootRadius, tipRadius } = input;
  if (!/^[a-z][a-z0-9-]*$/.test(id) || count < 6 || count > 12 || !Number.isInteger(count)
    || rootRadius < 4 || tipRadius < rootRadius + 1.1 || tipRadius > 10.2) throw new Error("Invalid gear profile");
  const sector = 2 * Math.PI / count;
  const polar = (radius: number, fraction: number): Point => [
    rounded(center[0] + radius * Math.cos(sector * fraction)),
    rounded(center[1] + radius * Math.sin(sector * fraction)),
  ];
  const points = [polar(rootRadius, -0.5), polar(rootRadius, -0.31), polar(tipRadius, -0.22),
    polar(tipRadius, 0.22), polar(rootRadius, 0.31), polar(rootRadius, 0.5)];
  return { id, commands: points.map((point, index) => [index ? "L" : "M", ...point] as ["M" | "L", number, number]),
    repeat: { kind: "radial", center, count }, join: "closed" };
}

/** Candidate-only normalization for an explicitly identified rigid gear body. */
export function normalizeIsometricGearGeometry(geometry: SvgGeometryPlan | undefined, subjectText: string) {
  if (!geometry || !/(齿轮|gear|cogwheel)/i.test(subjectText)) return geometry;
  const radial = geometry.paths.filter(path => path.repeat?.kind === "radial");
  if (radial.length !== 1) return geometry;
  const source = radial[0], repeat = source.repeat;
  if (!repeat || repeat.kind !== "radial" || repeat.count < 6 || repeat.count > 12) return geometry;
  let current: Point = [0, 0];
  const radii: number[] = [];
  for (const command of source.commands) {
    if (command[0] === "Z") continue;
    if (command[0] === "H") current = [command[1], current[1]];
    else if (command[0] === "V") current = [current[0], command[1]];
    else current = [command.at(-2) as number, command.at(-1) as number];
    radii.push(Math.hypot(current[0] - repeat.center[0], current[1] - repeat.center[1]));
  }
  if (radii.length < 4) return geometry;
  // A shallow, constant tooth depth reads as a gear rather than a spiky star
  // once the side wall and oblique projection are added.
  const rootRadius = Math.max(7.2, Math.min(7.4, Math.min(...radii)));
  const tipRadius = Math.max(rootRadius + 1.55, Math.min(9.1, Math.max(...radii)));
  return svgGeometryPlanSchema.parse({ ...geometry, paths: geometry.paths.map(path => path.id === source.id
    ? radialGearPath({ id: path.id, center: repeat.center, count: repeat.count, rootRadius, tipRadius }) : path) });
}
