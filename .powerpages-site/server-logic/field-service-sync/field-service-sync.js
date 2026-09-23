// Centralized Power Pages Server Logic synchronization endpoint.
//
// The browser sends business commands, not arbitrary Dataverse patches.
// This sample maps a Work Order execution draft to documented Field Service
// Work Order fields. Production writes remain disabled by site setting until
// security/licensing/idempotency review is complete.

const WORK_ORDERS = "msdyn_workorders";
const MAX_BATCH_SIZE = 20;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SYSTEM_STATUS = {
  inProgress: 690970002,
  completed: 690970003
};

function assertGuid(value, name) {
  if (!value || !GUID.test(value)) throw new Error(name + " must be a valid GUID.");
}

function assertIsoDate(value, name) {
  if (!value) return;
  const time = new Date(value).getTime();
  if (isNaN(time)) throw new Error(name + " must be an ISO-8601 date/time.");
}

function mapOperationToDataverse(operation) {
  if (operation.operation !== "submitWorkOrderExecution") {
    throw new Error("Unsupported operation: " + operation.operation);
  }

  assertGuid(operation.operationId, "operationId");
  assertGuid(operation.recordId, "recordId");

  const payload = operation.payload || {};
  if (payload.workOrderId !== operation.recordId) {
    throw new Error("payload.workOrderId must match recordId.");
  }

  if (!SYSTEM_STATUS[payload.status]) {
    throw new Error("status must be inProgress or completed.");
  }

  const technicianNote = typeof payload.technicianNote === "string"
    ? payload.technicianNote.trim()
    : "";

  if (technicianNote.length > 8000) {
    throw new Error("technicianNote must be 8000 characters or less.");
  }

  if (typeof payload.followUpRequired !== "boolean") {
    throw new Error("followUpRequired must be boolean.");
  }

  assertIsoDate(payload.arrivedOn, "arrivedOn");
  assertIsoDate(payload.completedOn, "completedOn");

  if (payload.status === "completed" && !payload.completedOn) {
    throw new Error("completedOn is required for completed status.");
  }

  const patch = {
    msdyn_systemstatus: SYSTEM_STATUS[payload.status],
    msdyn_followuprequired: payload.followUpRequired
  };

  if (technicianNote) patch.msdyn_followupnote = technicianNote;
  if (payload.arrivedOn) patch.msdyn_firstarrivedon = payload.arrivedOn;
  if (payload.completedOn) patch.msdyn_completedon = payload.completedOn;

  return patch;
}

function post() {
  const writesEnabled =
    String(Server.SiteSetting.Get("FieldService/EnableWriteDemo") || "").toLowerCase() === "true";

  if (!writesEnabled) {
    throw new Error(
      "Field Service synchronization writes are disabled. Enable only after security, licensing and idempotency review."
    );
  }

  const body = JSON.parse(Server.Context.Body || "{}");
  const operations = body.operations;

  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error("operations must be a non-empty array.");
  }

  if (operations.length > MAX_BATCH_SIZE) {
    throw new Error("Maximum batch size is " + MAX_BATCH_SIZE + ".");
  }

  const results = [];

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];

    try {
      const patch = mapOperationToDataverse(operation);

      Server.Connector.Dataverse.UpdateRecord(
        WORK_ORDERS,
        operation.recordId,
        JSON.stringify(patch)
      );

      results.push({
        operationId: operation.operationId,
        recordId: operation.recordId,
        status: "applied"
      });

      Server.Logger.Log(
        "Field Service sync applied. operationId=" +
          operation.operationId +
          " activityId=" +
          Server.Context.ActivityId
      );
    } catch (error) {
      results.push({
        operationId: operation && operation.operationId ? operation.operationId : "unknown",
        recordId: operation && operation.recordId ? operation.recordId : "unknown",
        status: "rejected",
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  return JSON.stringify({ results: results });
}
