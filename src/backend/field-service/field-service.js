const WORK_ORDERS = "msdyn_workorders";
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertGuid(value, name) {
  if (!value || !GUID.test(value)) throw new Error(name + " must be a valid GUID.");
}

function get() {
  const id = Server.Context.QueryParameters["id"];

  RuntimeLogger.info("field_service.read", { byId: Boolean(id) });

  if (id) {
    assertGuid(id, "id");
    return Server.Connector.Dataverse.RetrieveRecord(
      WORK_ORDERS,
      id,
      "$select=msdyn_workorderid,msdyn_name,msdyn_systemstatus,modifiedon",
      true
    );
  }

  return Server.Connector.Dataverse.RetrieveMultipleRecords(
    WORK_ORDERS,
    "$select=msdyn_workorderid,msdyn_name,msdyn_systemstatus,modifiedon&$orderby=modifiedon desc&$top=10",
    true
  );
}

function post() {
  const writesEnabled = RuntimeConfig.boolean(
    "FieldService/EnableWriteDemo",
    "ppa_FieldServiceEnableWriteDemo",
    false
  );

  if (!writesEnabled) {
    throw new Error("Field Service write demo is disabled. Enable it only after security and licensing review.");
  }

  const input = JSON.parse(Server.Context.Body || "{}");
  assertGuid(input.operationId, "operationId");
  assertGuid(input.recordId, "recordId");

  if (input.operation !== "updateName") throw new Error("Unsupported operation.");

  const name = input.patch && input.patch.msdyn_name;
  if (typeof name !== "string" || !name.trim() || name.length > 250) {
    throw new Error("patch.msdyn_name must be a non-empty string up to 250 characters.");
  }

  const response = Server.Connector.Dataverse.UpdateRecord(
    WORK_ORDERS,
    input.recordId,
    JSON.stringify({ msdyn_name: name.trim() })
  );

  RuntimeDataverse.assertSuccess(response, "Update Work Order");
  RuntimeLogger.info("field_service.update_applied", {
    operationId: input.operationId,
    recordId: input.recordId
  });

  return JSON.stringify({
    operationId: input.operationId,
    recordId: input.recordId
  });
}
