param(
  [Parameter(Mandatory = $true)][string]$BacpacPath,
  [string]$OutputPath = (Join-Path $PSScriptRoot 'mssql-source-schema.md')
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $BacpacPath))
try {
  $entry = $archive.GetEntry('model.xml')
  if (-not $entry) { throw 'BACPAC has no model.xml' }
  $reader = [IO.StreamReader]::new($entry.Open())
  try { [xml]$document = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $archive.Dispose() }

$namespaces = [Xml.XmlNamespaceManager]::new($document.NameTable)
$namespaces.AddNamespace('d', 'http://schemas.microsoft.com/sqlserver/dac/Serialization/2012/02')
$lines = [Collections.Generic.List[string]]::new()
$lines.Add('# MSSQL schema found in DeliverySystem.bacpac')
$lines.Add('')
$lines.Add('Generated from the BACPAC model.xml. This contains schema metadata only, no table rows.')
$lines.Add('')
foreach ($table in $document.SelectNodes("//d:Model/d:Element[@Type='SqlTable']", $namespaces)) {
  $tableName = $table.GetAttribute('Name') -replace '^\[dbo\]\.\[|\]$', ''
  $lines.Add("## $tableName")
  $lines.Add('')
  $lines.Add('| Column | MSSQL type | Nullable | Identity |')
  $lines.Add('| --- | --- | --- | --- |')
  foreach ($column in $table.SelectNodes("d:Relationship[@Name='Columns']/d:Entry/d:Element", $namespaces)) {
    $columnName = ($column.GetAttribute('Name') -split '\.\[')[-1].TrimEnd(']')
    $typeNode = $column.SelectSingleNode("d:Relationship[@Name='TypeSpecifier']/d:Entry/d:Element", $namespaces)
    $typeName = $typeNode.SelectSingleNode("d:Relationship[@Name='Type']/d:Entry/d:References", $namespaces).GetAttribute('Name').Trim('[', ']')
    $properties = @{}
    foreach ($property in $typeNode.SelectNodes('d:Property', $namespaces)) { $properties[$property.GetAttribute('Name')] = $property.GetAttribute('Value') }
    if ($properties.ContainsKey('Length')) { $typeName += "($($properties.Length))" }
    if ($properties.ContainsKey('Precision')) { $typeName += "($($properties.Precision),$($properties.Scale))" }
    $nullable = if ($column.SelectSingleNode("d:Property[@Name='IsNullable' and @Value='False']", $namespaces)) { 'No' } else { 'Yes' }
    $identity = if ($column.SelectSingleNode("d:Property[@Name='IsIdentity' and @Value='True']", $namespaces)) { 'Yes' } else { 'No' }
    $lines.Add("| $columnName | $typeName | $nullable | $identity |")
  }
  $lines.Add('')
}
Set-Content -LiteralPath $OutputPath -Value $lines -Encoding utf8
Write-Output "Wrote schema metadata to $OutputPath"
