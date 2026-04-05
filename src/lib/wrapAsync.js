/**
 * Lie la promesse d’un handler / middleware async à Express (évite les promesses flottantes).
 */
export function wrapAsync(fn) {
  return function wrapped(req, res, next) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}
