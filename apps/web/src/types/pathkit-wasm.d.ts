declare module "pathkit-wasm" {
  type EnumValue = object;
  interface Path {
    stroke(options: { width: number; cap: EnumValue; join: EnumValue }): Path | null;
    toSVGString(): string;
    getFillType(): EnumValue;
    transform(...matrix: number[]): Path;
    delete(): void;
  }
  interface PathKit {
    FromSVGString(d: string): Path | null;
    FillType: { WINDING: EnumValue; EVENODD: EnumValue };
    StrokeCap: { ROUND: EnumValue };
    StrokeJoin: { ROUND: EnumValue };
  }
  export default function initialize(options: { wasmBinary: Uint8Array }): Promise<PathKit>;
}
