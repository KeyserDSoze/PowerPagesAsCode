# Dynamics 365 Field Service licensing guardrail

This document is an engineering guardrail, not legal advice. Verify contractual rights with your Microsoft licensing representative/reseller for the exact tenant, user population and operations.

## Why this matters

Power Pages licensing and Dynamics 365 application licensing overlap when a custom site accesses Dataverse tables associated with Dynamics 365 applications.

Microsoft's current licensing guidance states that **multiplexing does not reduce the number of licenses required**. Adding an API, service account, queue, integration user or other middleware tier does not by itself remove licensing obligations for the people indirectly using the product.

Microsoft also documents Dynamics 365 **restricted tables**. Many Field Service tables require a Field Service license for create/update/delete operations.

Examples listed by Microsoft include:

- `msdyn_workorder`
- `msdyn_workorderservicetask`
- `msdyn_workorderproduct`
- `msdyn_workorderservice`
- `BookableResourceBooking`
- `BookableResource`
- `msdyn_customerasset`
- inventory/RMA/agreement tables

The Work Order table has a documented limited exception for self-reporting scenarios; that exception does not generally permit acting like a field technician completing/closing service work.

## Consequence for this boilerplate

The `field-service` endpoint demonstrates the technical pattern but its POST write is disabled by default.

Do **not** enable it on the assumption that:

```text
Power Pages licensed user
  -> Server Logic
  -> service principal/shared service user
  -> Field Service restricted table
  = no Field Service license needed
```

That conclusion is not supported by the general Microsoft multiplexing guidance.

## External users

Dynamics 365 licensing guidance has specific rules for external users and Power Pages/custom applications. Whether a person qualifies as an external user is a licensing definition, not merely whether the account is a guest in Entra ID.

Document the user population (employees, contractors, partners, customers), the tables touched, and whether operations are read-only or create/update/delete before deciding the license model.

## Engineering review template

For each Field Service command, record:

| Question | Example |
| --- | --- |
| User class | employee technician / contractor / customer |
| Table | `msdyn_workorder` |
| Operation | read / create / update / delete |
| Business action | change name / complete work / book resource |
| Restricted table? | yes/no |
| License conclusion | link to written Microsoft/reseller confirmation |
| Identity used technically | Power Pages user context / approved integration app |

## Official references

- Multiplexing: https://www.microsoft.com/licensing/guidance/multiplexing
- Dynamics 365 licensing guidance: https://www.microsoft.com/licensing/guidance/Dynamics-365
- Power Platform licensing guidance: https://www.microsoft.com/licensing/guidance/Power-Platform
- Restricted tables: https://learn.microsoft.com/power-apps/maker/data-platform/data-platform-restricted-entities
- Field Service license compliance objects: https://learn.microsoft.com/dynamics365/field-service/license-compliance-field-service
