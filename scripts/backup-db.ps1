param(
  [string]$DbName = "clinica_colas",
  [string]$DbUser = "postgres",
  [string]$DbHost = "localhost",
  [string]$DbPort = "5432",
  [string]$BackupDir = ".\backups",
  [int]$RetainDays = 7
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$filename = "backup_${DbName}_${timestamp}.sql"
$filepath = Join-Path $BackupDir $filename

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

Write-Host "Creando backup de $DbName en $filepath ..."

$env:PGPASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { Read-Host "Contraseña de PostgreSQL" -AsSecureString | . { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($args[0])) } }

pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName -F c -f $filepath

if ($LASTEXITCODE -eq 0) {
  Write-Host "Backup completado: $filepath" -ForegroundColor Green

  $oldDate = (Get-Date).AddDays(-$RetainDays)
  Get-ChildItem -Path $BackupDir -Filter "backup_${DbName}_*.sql" | Where-Object {
    $_.LastWriteTime -lt $oldDate
  } | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host " Eliminado backup antiguo: $($_.Name)" -ForegroundColor Yellow
  }
} else {
  Write-Host "Error al crear el backup" -ForegroundColor Red
  exit 1
}
