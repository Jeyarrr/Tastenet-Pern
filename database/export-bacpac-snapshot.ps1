# Emits JSON lines to a consuming process. Do not redirect this output to a file:
# it contains customer details and legacy plaintext passwords in transit.
param([string]$DatabaseName = 'DeliverySystem_BacpacSnapshot')

Add-Type -AssemblyName System.Data
$connection = [System.Data.SqlClient.SqlConnection]::new(
  "Data Source=(localdb)\tastenet;Initial Catalog=$DatabaseName;Integrated Security=True;Connect Timeout=15;Encrypt=False")
$tables = @(
  'Users','Suppliers','InventoryCategories','Menu','DeliveryFees','PaymentMethods','Quotas',
  'Inventory','Tickets','MenuRecipeIngredients','InventoryTransactions','TicketItems',
  'RiderDocApprovals','TransactionAudit','AdminAccounts','ApplicationSettings',
  'AuditLogs','EmailOTP','OrderStatusLog','Proofs','PurchaseOrders','PurchaseOrderItems'
)
try {
  $connection.Open()
  foreach ($table in $tables) {
    $command = $connection.CreateCommand()
    $command.CommandText = "SELECT * FROM dbo.[$table]"
    $reader = $command.ExecuteReader()
    try {
      while ($reader.Read()) {
        $record = [ordered]@{ _table = $table }
        for ($index = 0; $index -lt $reader.FieldCount; $index++) {
          $value = $reader.GetValue($index)
          $record[$reader.GetName($index)] = if ($value -is [DBNull]) { $null } else { $value }
        }
        ConvertTo-Json -InputObject $record -Compress -Depth 10
      }
    } finally { $reader.Dispose(); $command.Dispose() }
  }
} finally { $connection.Dispose() }
