// Power Pages Server Logic facade for a deliberately small Field Service example.
//
// Security boundary:
// - endpoint access must be assigned to the correct Power Pages Web Role;
// - Dataverse access is governed by Power Pages table permissions;
// - this facade or a service principal is not a licensing bypass.
//
// POST is disabled unless FieldService/EnableWriteDemo is "true".

const WORK_ORDERS = "msdyn_workorders";
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertGuid(value, name) {
  if (!value || !GUID.test(value)) throw new Error(name + " must be a valid GUID.");
}

function get() {
  const id = Server.Context.QueryParameters["id"];

  if (id) {
    assertGuid(id, "id");
    return Server.Connector.Dataverse.RetrieveRecord(
      WORK_ORDERS,
      id,
      "$select=msdyn_workorderid,msdyn_name,modifiedon"
    );
  }

  return Server.Connector.Dataverse.RetrieveMultipleRecords(
    WORK_ORDERS,
    "$select=msdyn_workorderid,msdyn_name,modifiedon&$orderby=modifiedon desc&$top=10"
  );
}

function post() {
  const writesEnabled = String(Server.SiteSetting.Get("FieldService/EnableWriteDemo") || "").toLowerCase() === "true";
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

  Server.Logger.Log("Field Service update accepted. ActivityId=" + Server.Context.ActivityId);

  return JSON.stringify({
    operationId: input.operationId,
    recordId: input.recordId,
    dataverse: response
  });
}
