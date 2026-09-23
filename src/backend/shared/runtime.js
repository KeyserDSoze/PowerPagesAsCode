// Shared Power Pages Server Logic prelude.
// This file is concatenated into each deployable endpoint at build time.
// It intentionally uses no module/import/require syntax.

const RuntimeConfig = {
  string: function (siteSettingName, environmentVariableName, fallbackValue) {
    let value = null;

    if (siteSettingName) {
      value = Server.SiteSetting.Get(siteSettingName);
    }

    if ((value === null || value === undefined || value === "") && environmentVariableName) {
      value = Server.EnvironmentVariable.get(environmentVariableName);
    }

    if (value === null || value === undefined || value === "") return fallbackValue;
    return String(value);
  },

  boolean: function (siteSettingName, environmentVariableName, fallbackValue) {
    const value = RuntimeConfig.string(
      siteSettingName,
      environmentVariableName,
      fallbackValue ? "true" : "false"
    );
    return String(value).toLowerCase() === "true";
  },

  number: function (siteSettingName, environmentVariableName, fallbackValue) {
    const value = Number(RuntimeConfig.string(
      siteSettingName,
      environmentVariableName,
      String(fallbackValue)
    ));
    return isNaN(value) ? fallbackValue : value;
  }
};

const RuntimeLogger = {
  log: function (level, eventName, details) {
    const entry = {
      level: level,
      event: eventName,
      activityId: Server.Context.ActivityId,
      userId: Server.User ? Server.User.id : null,
      details: details || {}
    };

    Server.Logger.Log(JSON.stringify(entry));
  },

  info: function (eventName, details) {
    RuntimeLogger.log("info", eventName, details);
  },

  warn: function (eventName, details) {
    RuntimeLogger.log("warn", eventName, details);
  },

  error: function (eventName, details) {
    RuntimeLogger.log("error", eventName, details);
  }
};

const RuntimeDataverse = {
  assertSuccess: function (response, operationName) {
    if (!response || !response.IsSuccessStatusCode) {
      const message = response && response.ServerErrorMessage
        ? response.ServerErrorMessage
        : operationName + " failed.";
      throw new Error(message);
    }
    return response;
  },

  body: function (response, fallbackValue) {
    RuntimeDataverse.assertSuccess(response, "Dataverse operation");
    if (!response.Body) return fallbackValue;

    try {
      return JSON.parse(response.Body);
    } catch (error) {
      throw new Error("Dataverse returned an invalid JSON body.");
    }
  }
};

function runtimeError(message, code, retryable) {
  const error = new Error(message);
  error.code = code || "SERVER_ERROR";
  error.retryable = retryable === true;
  return error;
}
