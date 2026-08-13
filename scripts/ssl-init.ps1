# ============================================================
# Script de generación de certificados SSL autofirmados (Windows/PowerShell)
# ------------------------------------------------------------
# Crea un certificado autofirmado para un dominio (por defecto localhost)
# y lo exporta como fullchain.pem + privkey.pem en ./certs, en el formato
# que espera nginx.conf (/etc/nginx/ssl/). Útil para HTTPS en desarrollo o
# despliegues internos; para producción se recomienda un CA real (Let's Encrypt).
#
# Requiere: PowerShell + OpenSSL en el PATH.
# ============================================================
param(
  [string]$Domain = "localhost",
  [int]$ValidDays = 365
)

$certsDir = Join-Path $PSScriptRoot "..\certs"
New-Item -ItemType Directory -Path $certsDir -Force | Out-Null

$cert = New-SelfSignedCertificate `
  -DnsName $Domain `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddDays($ValidDays) `
  -KeyExportPolicy Exportable `
  -KeySpec Signature

$pwd = ConvertTo-SecureString -String "temp-dev-only" -Force -AsPlainText

$pfxPath = Join-Path $certsDir "certificate.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd | Out-Null

$cerPath = Join-Path $certsDir "certificate.crt"
Export-Certificate -Cert $cert -FilePath $cerPath -Type CERT | Out-Null

openssl pkcs12 -in $pfxPath -nocerts -nodes -password pass:temp-dev-only -out (Join-Path $certsDir "privkey.pem")
openssl pkcs12 -in $pfxPath -clcerts -nokeys -password pass:temp-dev-only -out (Join-Path $certsDir "fullchain.pem")

Write-Host "Certificados generados en: $certsDir"
Write-Host "  fullchain.pem (público)"
Write-Host "  privkey.pem (privado)"
