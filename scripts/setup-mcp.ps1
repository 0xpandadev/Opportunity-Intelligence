param(
  [ValidateSet('core','catalog')]
  [string]$Profile = 'core',
  [string]$McpRoot = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not $McpRoot) { $McpRoot = Join-Path (Split-Path $repoRoot -Parent) 'mcp-servers' }
$McpRoot = [System.IO.Path]::GetFullPath($McpRoot)

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Required command not found: $Name" }
}

function Ensure-GitRepository([string]$Name, [string]$Url) {
  $target = Join-Path $McpRoot $Name
  if (-not (Test-Path -LiteralPath $target)) {
    git clone --depth 1 $Url $target
    if ($LASTEXITCODE -ne 0) { throw "git clone failed: $Name" }
  }
  return $target
}

function Invoke-NpmInstall([string]$Directory) {
  Push-Location $Directory
  try {
    if (Test-Path -LiteralPath 'package-lock.json') { & npm.cmd ci } else { & npm.cmd install }
    if ($LASTEXITCODE -ne 0) { throw "npm install failed: $Directory" }
  } finally { Pop-Location }
}

function Invoke-PythonEditableInstall([string]$Directory) {
  $venv = Join-Path $Directory '.venv'
  if (-not (Test-Path -LiteralPath $venv)) { python -m venv $venv }
  $python = Join-Path $venv 'Scripts\python.exe'
  & $python -m pip install --upgrade pip
  & $python -m pip install -e $Directory
  if ($LASTEXITCODE -ne 0) { throw "Python package installation failed: $Directory" }
}

Write-Host "Opportunity Intelligence MCP setup"
Write-Host "MCP root: $McpRoot"
Write-Host "Profile: $Profile"

if ($Profile -eq 'catalog') {
  Write-Host "Catalog only: no software was installed."
  Write-Host "See docs\MCP-CATALOG.md and config\connectors.json."
  exit 0
}

Require-Command git
Require-Command node
Require-Command npm.cmd
Require-Command python
New-Item -ItemType Directory -Path $McpRoot -Force | Out-Null

$npmRoot = Join-Path $McpRoot 'npm-servers'
New-Item -ItemType Directory -Path $npmRoot -Force | Out-Null
Push-Location $npmRoot
try {
  if (-not (Test-Path -LiteralPath 'package.json')) { & npm.cmd init -y | Out-Null }
  & npm.cmd install --save-exact hourei-mcp-server@1.0.6 tax-law-mcp@0.5.4 labor-law-mcp@0.2.1 '@dangahagan/weather-mcp@1.13.0' '@melaodoidao/datagov-mcp-server@latest'
  if ($LASTEXITCODE -ne 0) { throw 'Core npm MCP installation failed' }
} finally { Pop-Location }

$japanGov = Ensure-GitRepository 'japan-gov-mcp' 'https://github.com/Agentic-governance/japan-gov-mcp.git'
Invoke-NpmInstall $japanGov
Push-Location $japanGov
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Japan Government MCP build failed' }
} finally { Pop-Location }

$data360 = Ensure-GitRepository 'data360-mcp' 'https://github.com/worldbank/data360-mcp.git'
Invoke-PythonEditableInstall $data360

$imf = Ensure-GitRepository 'imf-data-mcp' 'https://github.com/c-cf/imf-data-mcp.git'
Invoke-PythonEditableInstall $imf

$localConfig = @{
  mcp_root = $McpRoot
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  servers = @(
    @{ id='japan_gov_mcp'; state='installed_pending_verification' },
    @{ id='hourei_mcp'; state='installed_pending_verification' },
    @{ id='tax_law_mcp'; state='installed_pending_verification' },
    @{ id='labor_law_mcp'; state='installed_pending_verification' },
    @{ id='datagov_mcp'; state='installed_pending_verification' },
    @{ id='weather_global_mcp'; state='installed_pending_verification' },
    @{ id='world_bank_data360_mcp'; state='installed_pending_verification' },
    @{ id='imf_data_mcp'; state='installed_pending_verification' }
  )
}
$localPath = Join-Path $repoRoot 'config\mcp-servers.local.json'
$localConfig | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $localPath -Encoding utf8

Write-Host "Core MCP installation completed."
Write-Host "Local machine configuration: $localPath"
Write-Host 'Restart Codex after registering MCP servers in your Codex configuration.'
Write-Host 'Providers requiring API keys, Docker, or manual terms acceptance were not installed.'
