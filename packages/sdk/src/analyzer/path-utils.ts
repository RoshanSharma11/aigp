export const joinRoutePaths = (
  ...segments: readonly (string | undefined)[]
): string => {
  const normalizedSegments = segments
    .filter((segment): segment is string => segment !== undefined)
    .map((segment) => segment.replace(/^\/+|\/+$/gu, ""))
    .filter((segment) => segment.length > 0);

  if (normalizedSegments.length === 0) {
    return "/";
  }

  return `/${normalizedSegments.join("/")}`;
};

export const buildRouteId = (
  controllerName: string,
  handlerName: string,
  method: string,
  routePath: string,
): string => {
  const controllerSlug = controllerName
    .replace(/Controller$/u, "")
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .toLowerCase();
  const handlerSlug = handlerName
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .toLowerCase();
  const pathSlug = routePath
    .replace(/^\/api\//u, "")
    .replace(/\//gu, "_")
    .replace(/:/gu, "")
    .replace(/-/gu, "_");

  return `${controllerSlug}_${handlerSlug}_${method.toLowerCase()}_${pathSlug}`;
};
