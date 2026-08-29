declare module "bwip-js" {
  export function toCanvas(
    canvas: HTMLCanvasElement | string,
    options: Record<string, any>
  ): HTMLCanvasElement;
  const bwipjs: {
    toCanvas(
      canvas: HTMLCanvasElement | string,
      options: Record<string, any>
    ): HTMLCanvasElement;
  };
  export default bwipjs;
}
