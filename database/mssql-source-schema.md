# MSSQL schema found in DeliverySystem.bacpac

Generated from the BACPAC model.xml. This contains schema metadata only, no table rows.

## AdminAccounts

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| AdminId | int | No | Yes |
| Email | nvarchar(200) | No | No |
| Username | nvarchar(100) | No | No |
| PasswordHash | nvarchar(255) | No | No |
| FullName | nvarchar(200) | Yes | No |
| Role | nvarchar(50) | Yes | No |
| IsActive | bit | Yes | No |
| IsTwoFactorEnabled | bit | Yes | No |
| TwoFactorSecretKey | nvarchar(255) | Yes | No |
| LastLoginDate | datetime | Yes | No |
| LastLoginIP | nvarchar(50) | Yes | No |
| CreatedDate | datetime | Yes | No |
| ModifiedDate | datetime | Yes | No |
| CreatedBy | nvarchar(100) | Yes | No |

## ApplicationSettings

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| SettingId | int | No | Yes |
| SettingKey | nvarchar(100) | No | No |
| SettingValue | nvarchar | Yes | No |
| SettingDataType | nvarchar(20) | Yes | No |
| SettingCategory | nvarchar(50) | Yes | No |
| IsEncrypted | bit | Yes | No |
| CreatedDate | datetime | Yes | No |
| ModifiedDate | datetime | Yes | No |
| ModifiedBy | nvarchar(100) | Yes | No |

## AuditLogs

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| LogId | int | No | Yes |
| ActionType | nvarchar(50) | Yes | No |
| TableName | nvarchar(100) | Yes | No |
| RecordId | nvarchar(100) | Yes | No |
| OldValue | nvarchar | Yes | No |
| NewValue | nvarchar | Yes | No |
| PerformedBy | nvarchar(100) | Yes | No |
| PerformedDate | datetime | Yes | No |
| IPAddress | nvarchar(50) | Yes | No |

## DeliveryFees

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| DeliveryFeeID | int | No | Yes |
| BarangayName | nvarchar(100) | No | No |
| Fee | decimal(10,2) | No | No |
| CreatedAt | datetime | Yes | No |
| UpdatedAt | datetime | Yes | No |

## EmailOTP

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| OTPID | int | No | Yes |
| Email | nvarchar(100) | No | No |
| OTPCode | nvarchar(6) | No | No |
| IsVerified | bit | Yes | No |
| ExpiresAt | datetime | No | No |
| CreatedAt | datetime | Yes | No |

## Inventory

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| InventoryID | int | No | Yes |
| ItemCode | nvarchar(50) | No | No |
| ItemName | nvarchar(100) | No | No |
| CategoryID | int | Yes | No |
| SupplierID | int | Yes | No |
| Description | nvarchar(255) | Yes | No |
| UnitOfMeasure | nvarchar(20) | No | No |
| CurrentStock | decimal(12,2) | Yes | No |
| MinimumStock | decimal(12,2) | Yes | No |
| MaximumStock | decimal(12,2) | Yes | No |
| ReorderLevel | decimal(12,2) | Yes | No |
| UnitCost | decimal(12,2) | No | No |
| UnitPrice | decimal(12,2) | No | No |
| IsActive | bit | Yes | No |
| IsAvailable | bit | Yes | No |
| IsPerishable | bit | Yes | No |
| ExpiryDate | date | Yes | No |
| CreatedAt | datetime | Yes | No |
| UpdatedAt | datetime | Yes | No |
| LastStockTake | date | Yes | No |

## InventoryCategories

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| CategoryID | int | No | Yes |
| CategoryName | nvarchar(50) | No | No |
| Description | nvarchar(255) | Yes | No |
| IsActive | bit | Yes | No |
| CreatedAt | datetime | Yes | No |

## InventoryTransactions

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| TransactionID | int | No | Yes |
| InventoryID | int | No | No |
| TransactionType | nvarchar(20) | No | No |
| Quantity | decimal(12,2) | No | No |
| PreviousStock | decimal(12,2) | No | No |
| NewStock | decimal(12,2) | No | No |
| ReferenceNumber | nvarchar(100) | Yes | No |
| Notes | nvarchar(500) | Yes | No |
| TransactionDate | datetime | Yes | No |
| PerformedBy | int | Yes | No |

## Menu

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| MenuID | int | No | Yes |
| FoodName | varchar(100) | No | No |
| FoodType | varchar(50) | Yes | No |
| Price | decimal(10,2) | No | No |
| ImagePath | varchar(255) | Yes | No |
| Status | varchar(20) | Yes | No |
| Description | varchar(255) | Yes | No |
| Ratings | decimal(2,1) | Yes | No |

## MenuRecipeIngredients

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| RecipeID | int | No | Yes |
| MenuID | int | No | No |
| InventoryID | int | No | No |
| QuantityRequired | decimal(10,3) | No | No |

## OrderStatusLog

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| LogID | int | No | Yes |
| OrderId | nvarchar(50) | Yes | No |
| OldStatus | nvarchar(20) | Yes | No |
| NewStatus | nvarchar(20) | Yes | No |
| ChangedBy | int | Yes | No |
| ChangedDate | datetime | Yes | No |

## PaymentMethods

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| PaymentMethodId | int | No | Yes |
| MethodName | nvarchar(50) | No | No |
| IsEnabled | bit | Yes | No |
| DisplayOrder | int | Yes | No |
| AccountDetails | nvarchar | Yes | No |
| Instructions | nvarchar | Yes | No |
| CreatedDate | datetime | Yes | No |
| ModifiedDate | datetime | Yes | No |

## Proofs

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| ProofID | int | No | Yes |
| TicketID | int | No | No |
| ProofOfPayment | nvarchar(255) | Yes | No |
| ProofOfDelivery | nvarchar(255) | Yes | No |
| CreatedAt | datetime | Yes | No |

## PurchaseOrderItems

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| POItemID | int | No | Yes |
| PurchaseOrderID | int | No | No |
| InventoryID | int | No | No |
| Quantity | decimal(12,2) | No | No |
| UnitCost | decimal(12,2) | No | No |
| TotalCost | decimal(12,2) | No | No |
| QuantityReceived | decimal(12,2) | Yes | No |

## PurchaseOrders

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| PurchaseOrderID | int | No | Yes |
| PONumber | nvarchar(50) | No | No |
| SupplierID | int | No | No |
| OrderDate | datetime | Yes | No |
| ExpectedDelivery | date | Yes | No |
| ActualDelivery | date | Yes | No |
| Status | nvarchar(20) | Yes | No |
| TotalAmount | decimal(12,2) | Yes | No |
| Notes | nvarchar(500) | Yes | No |
| CreatedBy | int | Yes | No |
| ApprovedBy | int | Yes | No |

## Quotas

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| QuotaID | int | No | Yes |
| QuotaType | varchar(10) | No | No |
| TargetAmount | decimal(18,2) | No | No |
| StartDate | date | No | No |
| EndDate | date | No | No |
| CreatedAt | datetime | Yes | No |
| UpdatedAt | datetime | Yes | No |

## RiderDocApprovals

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| ID | int | No | Yes |
| UserID | int | No | No |
| DocColumn | nvarchar(50) | No | No |
| Status | nvarchar(20) | No | No |
| UpdatedAt | datetime | No | No |

## Suppliers

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| SupplierID | int | No | Yes |
| SupplierCode | nvarchar(50) | No | No |
| SupplierName | nvarchar(100) | No | No |
| ContactPerson | nvarchar(100) | Yes | No |
| Email | nvarchar(100) | Yes | No |
| Phone | nvarchar(20) | Yes | No |
| Address | nvarchar(255) | Yes | No |
| TaxID | nvarchar(50) | Yes | No |
| IsActive | bit | Yes | No |
| CreatedAt | datetime | Yes | No |

## TicketItems

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| TicketItemID | int | No | Yes |
| TicketID | int | No | No |
| MenuID | int | No | No |
| FoodName | nvarchar(100) | No | No |
| Quantity | decimal(10,2) | No | No |
| UnitPrice | decimal(10,2) | No | No |
| SubTotal | decimal(10,2) | No | No |
| SpecialInstructions | nvarchar(500) | Yes | No |
| Status | nvarchar(20) | Yes | No |

## Tickets

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| TicketID | int | No | Yes |
| TicketNumber | nvarchar(50) | No | No |
| OrderNumber | nvarchar(50) | No | No |
| OrderType | nvarchar(20) | No | No |
| DeliveryAddress | nvarchar(500) | Yes | No |
| Status | nvarchar(20) | No | No |
| Priority | nvarchar(10) | Yes | No |
| TotalAmount | decimal(10,2) | Yes | No |
| CreatedAt | datetime | Yes | No |
| StartedAt | datetime | Yes | No |
| CompletedAt | datetime | Yes | No |
| CreatedBy | int | Yes | No |
| UpdatedAt | datetime | Yes | No |
| PaymentMethod | nvarchar(50) | Yes | No |
| RiderID | int | Yes | No |

## TransactionAudit

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| AuditID | int | No | Yes |
| TransactionID | int | Yes | No |
| OldValue | nvarchar | Yes | No |
| NewValue | nvarchar | Yes | No |
| ChangeType | nvarchar(20) | Yes | No |
| ChangedBy | int | Yes | No |
| ChangeDate | datetime | Yes | No |

## Users

| Column | MSSQL type | Nullable | Identity |
| --- | --- | --- | --- |
| UserID | int | No | Yes |
| Username | nvarchar(50) | No | No |
| Password | nvarchar(255) | No | No |
| UserType | nvarchar(20) | No | No |
| FullName | nvarchar(100) | No | No |
| Email | nvarchar(100) | No | No |
| Phone | nvarchar(20) | Yes | No |
| Gender | nvarchar(10) | Yes | No |
| IsActive | bit | Yes | No |
| CreatedAt | datetime | Yes | No |
| ProfilePhoto | nvarchar(255) | Yes | No |
| LicenseNumber | nvarchar(50) | Yes | No |
| NBINumber | nvarchar(50) | Yes | No |
| Vehicle | nvarchar(50) | Yes | No |
| VehicleModel | nvarchar(100) | Yes | No |
| VehicleYear | nvarchar(10) | Yes | No |
| LicensePlate | nvarchar(30) | Yes | No |
| VehicleColor | nvarchar(50) | Yes | No |
| DriverLicensePhoto | nvarchar(255) | Yes | No |
| ORCRPhoto | nvarchar(255) | Yes | No |
| InsurancePhoto | nvarchar(255) | Yes | No |
| NBIClearancePhoto | nvarchar(255) | Yes | No |
| ORCRNumber | nvarchar(50) | Yes | No |
| InsurancePolicy | nvarchar(100) | Yes | No |
| InsuranceDate | date | Yes | No |
| RiderStatus | nvarchar(20) | Yes | No |
| AssignedOrders | int | Yes | No |
| CompletedOrders | int | Yes | No |
| Ratings | decimal(3,1) | Yes | No |
| DateJoined | datetime | Yes | No |
| Address | nvarchar(500) | Yes | No |

