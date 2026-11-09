import type { Request } from "express";

export function pathOf(request: Request): string {
  return request.path;
}
