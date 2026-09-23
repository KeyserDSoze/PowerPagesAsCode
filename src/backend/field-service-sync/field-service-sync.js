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

function assertNotStale(recordId, baseModifiedOn) {
  if (!baseModifiedOn) return;

  assertIsoDate(baseModifiedOn, "baseModifiedOn");

  const response = Server.Connector.Dataverse.RetrieveRecord(
    WORK_ORDERS,
    recordId,
    "$select=modifiedon",
    true
  );

  const remote = RuntimeDataverse.body(response, {});
  if (!remote.modifiedon) return;

  const localTime = new Date(baseModifiedOn).getTime();
  const remoteTime = new Date(remote.modifiedon).getTime();

  if (localTime !== remoteTime) {
    throw runtimeError(
      "The Work Order changed on the server after this offline draft was created.",
      "CONFLICT",
      false
    );
  }
}

function mapOperationToDataverse(operation) {
  if (operation.operation !== "submitWorkOrderExecution") {
    throw runtimeError("Unsupported operation: " + operation.operation, "VALIDATION", false);
  }

  assertGuid(operation.operationId, "operationId");
  assertGuid(operation.recordId, "recordId");

  const payload = operation.payload || {};
  if (payload.workOrderId !== operation.recordId) {
    throw runtimeError("payload.workOrderId must match recordId.", "VALIDATION", false);
  }

  if (!SYSTEM_STATUS[payload.status]) {
    throw runtimeError("status must be inProgress or completed.", "VALIDATION", false);
  }

  const technicianNote = typeof payload.technicianNote === "string"
    ? payload.technicianNote.trim()
    : "";

  if (technicianNote.length > 8000) {
    throw runtimeError("technicianNote must be 8000 characters or less.", "VALIDATION", false);
  }

  if (typeof payload.followUpRequired !== "boolean") {
    throw runtimeError("followUpRequired must be boolean.", "VALIDATION", false);
  }

  assertIsoDate(payload.arrivedOn, "arrivedOn");
  assertIsoDate(payload.completedOn, "completedOn");

  if (payload.status === "completed" && !payload.completedOn) {
    throw runtimeError("completedOn is required for completed status.", "VALIDATION", false);
  }

  assertNotStale(operation.recordId, payload.baseModifiedOn);

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
  const writesEnabled = RuntimeConfig.boolean(
    "FieldService/EnableWriteDemo",
    "ppa_FieldServiceEnableWriteDemo",
    false
  );

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
    let idempotencyState = null;

    try {
      assertGuid(operation.operationId, "operationId");
      idempotencyState = IdempotencyStore.begin(operation.operationId);

      if (idempotencyState.duplicate) {
        if (idempotencyState.status === "completed" && idempotencyState.response) {
          results.push(idempotencyState.response);
          continue;
        }

        results.push({
          operationId: operation.operationId,
          recordId: operation.recordId,
          status: "rejected",
          code: "IDEMPOTENCY_IN_PROGRESS",
          retryable: true,
          error: "This operation is already being processed."
        });
        continue;
      }

      const patch = mapOperationToDataverse(operation);

      RuntimeDataverse.assertSuccess(
        Server.Connector.Dataverse.UpdateRecord(
          WORK_ORDERS,
          operation.recordId,
          JSON.stringify(patch)
        ),
        "Update Work Order"
      );

      const applied = {
        operationId: operation.operationId,
        recordId: operation.recordId,
        status: "applied",
        retryable: false
      };

      IdempotencyStore.complete(idempotencyState.recordId, applied);
      results.push(applied);

      RuntimeLogger.info("field_service_sync.applied", {
        operationId: operation.operationId,
        recordId: operation.recordId
      });
    } catch (error) {
      const rejected = {
        operationId: operation && operation.operationId ? operation.operationId : "unknown",
        recordId: operation && operation.recordId ? operation.recordId : "unknown",
        status: "rejected",
        code: error && error.code ? error.code : "SERVER_ERROR",
        retryable: error && error.retryable === true,
        error: error && error.message ? error.message : String(error)
      };

      if (idempotencyState && !idempotencyState.duplicate) {
        try {
          IdempotencyStore.fail(idempotencyState.recordId, rejected);
        } catch (idempotencyError) {
          RuntimeLogger.error("idempotency.fail_record_failed", {
            operationId: rejected.operationId
          });
        }
      }

      results.push(rejected);

      RuntimeLogger.warn("field_service_sync.rejected", {
        operationId: rejected.operationId,
        recordId: rejected.recordId,
        code: rejected.code,
        retryable: rejected.retryable
      });
    }
  }

  return JSON.stringify({ results: results });
}
