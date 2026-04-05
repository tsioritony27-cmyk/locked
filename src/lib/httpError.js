export function httpError(status, code, message, field) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (field) err.field = field;
  return err;
}
