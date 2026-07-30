import type { RequestHandler } from "express";

type AsyncRequestHandler = (
  ...parameters: Parameters<RequestHandler>
) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}
