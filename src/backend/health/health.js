// Power Pages Server Logic runtime: ECMAScript 2023.
// Keep this file free of Node.js modules and browser-only APIs.

function get() {
  return JSON.stringify({
    status: "ok",
    activityId: Server.Context.ActivityId,
    user: Server.User ? Server.User.fullname : null,
    timestamp: new Date().toISOString()
  });
}
