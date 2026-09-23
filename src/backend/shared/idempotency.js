// Optional Dataverse-backed idempotency store.
//
// Disabled by default. To enable it, provision a custom Dataverse table with
// an alternate key on the operation-id column and configure the settings below.
//
// IMPORTANT: this store is a conservative deduplication skeleton, not a
// transactional exactly-once guarantee. The business write and idempotency
// completion record are separate Dataverse operations. For strict exactly-once
// semantics implement the command inside a Dataverse Custom API/plugin that
// owns the transaction.
//
// Default table contract:
// EntitySetName: ppa_syncoperations
// Primary key:   ppa_syncoperationid
// Operation ID:  ppa_operationid (text, alternate key)
// Status:        ppa_status (text)
// Response:      ppa_response (multiline text)

const IdempotencyStore = {
  enabled: function () {
    return RuntimeConfig.boolean(
      "Sync/IdempotencyEnabled",
      "ppa_SyncIdempotencyEnabled",
      false
    );
  },

  settings: function () {
    return {
      entitySetName: RuntimeConfig.string(
        "Sync/IdempotencyEntitySetName",
        "ppa_SyncIdempotencyEntitySetName",
        "ppa_syncoperations"
      ),
      idColumn: RuntimeConfig.string(
        "Sync/IdempotencyIdColumn",
        "ppa_SyncIdempotencyIdColumn",
        "ppa_syncoperationid"
      ),
      operationColumn: RuntimeConfig.string(
        "Sync/IdempotencyOperationColumn",
        "ppa_SyncIdempotencyOperationColumn",
        "ppa_operationid"
      ),
      statusColumn: RuntimeConfig.string(
        "Sync/IdempotencyStatusColumn",
        "ppa_SyncIdempotencyStatusColumn",
        "ppa_status"
      ),
      responseColumn: RuntimeConfig.string(
        "Sync/IdempotencyResponseColumn",
        "ppa_SyncIdempotencyResponseColumn",
        "ppa_response"
      )
    };
  },

  parseExisting: function (settings, existing) {
    let savedResponse = null;
    const responseText = existing[settings.responseColumn];

    if (responseText) {
      try {
        savedResponse = JSON.parse(responseText);
      } catch (error) {
        savedResponse = null;
      }
    }

    return {
      enabled: true,
      duplicate: true,
      recordId: existing[settings.idColumn],
      status: existing[settings.statusColumn],
      response: savedResponse
    };
  },

  find: function (operationId) {
    if (!IdempotencyStore.enabled()) return null;

    const settings = IdempotencyStore.settings();
    const query =
      "$select=" +
      settings.idColumn + "," +
      settings.statusColumn + "," +
      settings.responseColumn +
      "&$filter=" + settings.operationColumn + " eq '" + operationId + "'" +
      "&$top=1";

    const response = Server.Connector.Dataverse.RetrieveMultipleRecords(
      settings.entitySetName,
      query,
      true
    );

    const body = RuntimeDataverse.body(response, { value: [] });
    const records = body && Array.isArray(body.value) ? body.value : [];
    return records.length > 0 ? records[0] : null;
  },

  begin: function (operationId) {
    if (!IdempotencyStore.enabled()) {
      return { enabled: false, duplicate: false, recordId: null, response: null };
    }

    const settings = IdempotencyStore.settings();
    const existing = IdempotencyStore.find(operationId);

    if (existing) {
      return IdempotencyStore.parseExisting(settings, existing);
    }

    const createPayload = {};
    createPayload[settings.operationColumn] = operationId;
    createPayload[settings.statusColumn] = "processing";

    const createResponse = Server.Connector.Dataverse.CreateRecord(
      settings.entitySetName,
      JSON.stringify(createPayload)
    );

    if (!createResponse || !createResponse.IsSuccessStatusCode) {
      // A concurrent request may have won the alternate-key race. Re-read the
      // operation before surfacing the create error.
      const raced = IdempotencyStore.find(operationId);
      if (raced) return IdempotencyStore.parseExisting(settings, raced);

      RuntimeDataverse.assertSuccess(
        createResponse,
        "Create idempotency record"
      );
    }

    const created = IdempotencyStore.find(operationId);
    if (!created) {
      throw new Error("Idempotency record was created but could not be retrieved.");
    }

    return {
      enabled: true,
      duplicate: false,
      recordId: created[settings.idColumn],
      response: null
    };
  },

  complete: function (recordId, responsePayload) {
    if (!IdempotencyStore.enabled() || !recordId) return;

    const settings = IdempotencyStore.settings();
    const payload = {};
    payload[settings.statusColumn] = "completed";
    payload[settings.responseColumn] = JSON.stringify(responsePayload);

    RuntimeDataverse.assertSuccess(
      Server.Connector.Dataverse.UpdateRecord(
        settings.entitySetName,
        recordId,
        JSON.stringify(payload)
      ),
      "Complete idempotency record"
    );
  },

  fail: function (recordId, errorPayload) {
    if (!IdempotencyStore.enabled() || !recordId) return;

    const settings = IdempotencyStore.settings();
    const payload = {};
    payload[settings.statusColumn] = errorPayload && errorPayload.retryable
      ? "failed"
      : "rejected";
    payload[settings.responseColumn] = JSON.stringify(errorPayload);

    RuntimeDataverse.assertSuccess(
      Server.Connector.Dataverse.UpdateRecord(
        settings.entitySetName,
        recordId,
        JSON.stringify(payload)
      ),
      "Fail idempotency record"
    );
  }
};
