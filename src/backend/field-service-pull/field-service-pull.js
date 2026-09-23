const WORK_ORDERS = "msdyn_workorders";

function parseLimit(value) {
  const parsed = Number(value || "50");
  if (!isFinite(parsed) || parsed < 1) return 50;
  return Math.min(Math.floor(parsed), 100);
}

function parseCursor(value) {
  if (!value) return null;

  const timestamp = new Date(value);
  if (isNaN(timestamp.getTime())) {
    throw new Error("cursor must be an ISO-8601 date/time.");
  }

  return timestamp.toISOString();
}

function get() {
  const limit = parseLimit(Server.Context.QueryParameters["limit"]);
  const cursor = parseCursor(Server.Context.QueryParameters["cursor"]);

  let options =
    "$select=msdyn_workorderid,msdyn_name,msdyn_systemstatus,modifiedon" +
    "&$top=" + limit;

  if (cursor) {
    options +=
      "&$filter=modifiedon gt " + cursor +
      "&$orderby=modifiedon asc";
  } else {
    options += "&$orderby=modifiedon desc";
  }

  const response = Server.Connector.Dataverse.RetrieveMultipleRecords(
    WORK_ORDERS,
    options,
    true
  );

  const body = RuntimeDataverse.body(response, { value: [] });
  const sourceRecords = body && Array.isArray(body.value) ? body.value : [];
  const records = [];
  let nextCursor = cursor;

  for (let i = 0; i < sourceRecords.length; i++) {
    const record = sourceRecords[i];

    records.push({
      id: record.msdyn_workorderid,
      name: record.msdyn_name || null,
      systemStatus: record.msdyn_systemstatus,
      modifiedOn: record.modifiedon
    });

    if (
      record.modifiedon &&
      (!nextCursor || new Date(record.modifiedon).getTime() > new Date(nextCursor).getTime())
    ) {
      nextCursor = record.modifiedon;
    }
  }

  RuntimeLogger.info("field_service_pull.completed", {
    recordCount: records.length,
    hasCursor: Boolean(cursor)
  });

  return JSON.stringify({
    records: records,
    nextCursor: nextCursor,
    hasMore: Boolean(cursor && records.length === limit)
  });
}
