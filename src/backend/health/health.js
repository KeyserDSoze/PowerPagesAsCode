function get() {
  RuntimeLogger.info("health.requested", {});

  return JSON.stringify({
    status: "ok",
    activityId: Server.Context.ActivityId,
    user: Server.User ? Server.User.fullname : null,
    timestamp: new Date().toISOString()
  });
}
