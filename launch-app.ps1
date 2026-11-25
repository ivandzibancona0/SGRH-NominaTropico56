# ====================================================================
# SGRH - Tropico 56 | Orquestador Silencioso de Servidor + Ventana App
# Ejecuta Node.js oculto y abre la aplicacion en modo ventana nativa
# (Microsoft Edge / Google Chrome --app) con cierre automatico limpio.
# ====================================================================

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms

$oAccent = [char]0x00F3
$iAccent = [char]0x00ED
$aAccent = [char]0x00E1
$eAccent = [char]0x00E9
$uAccent = [char]0x00FA
$AppTitle = "SGRH - Tr${oAccent}pico 56"

function Show-AppError([string]$Message) {
    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        $AppTitle,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

$ProjectDir = $PSScriptRoot
$LogsDir = Join-Path $ProjectDir 'logs'
$StdOutLog = Join-Path $LogsDir 'server.log'
$StdErrLog = Join-Path $LogsDir 'server-error.log'

if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

# 1. Leer puerto desde .env (fallback 3000)
$Port = 3000
$EnvFile = Join-Path $ProjectDir '.env'
if (Test-Path $EnvFile) {
    foreach ($line in (Get-Content -Path $EnvFile -ErrorAction SilentlyContinue)) {
        if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$') {
            $Port = [int]$Matches[1]
            break
        }
    }
}
$AppUrl = "http://localhost:$Port"

function Test-ServerReady([string]$Url) {
    try {
        $req = [System.Net.WebRequest]::Create($Url)
        $req.Method = 'HEAD'
        $req.Timeout = 1000
        $resp = $req.GetResponse()
        $resp.Close()
        return $true
    } catch {
        return $false
    }
}

# 2. Localizar navegador compatible con modo --app (Edge, Chrome o Brave)
function Find-AppBrowser {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe"
    )
    foreach ($path in $candidates) {
        if ($path -and (Test-Path $path)) {
            return $path
        }
    }
    return $null
}

$BrowserPath = Find-AppBrowser
if (-not $BrowserPath) {
    Show-AppError "No se encontr${oAccent} Microsoft Edge ni Google Chrome instalado para abrir la aplicaci${oAccent}n en modo ventana nativa."
    exit 1
}

# 3. Localizar Node.js
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
$NodePath = if ($NodeCmd) { $NodeCmd.Source } else { "$env:ProgramFiles\nodejs\node.exe" }
if (-not (Test-Path $NodePath)) {
    Show-AppError "No se encontr${oAccent} Node.js en este equipo. Instala Node.js e intenta nuevamente."
    exit 1
}

$NodeProc = $null
$StartedByLauncher = $false

try {
    # 4. Iniciar servidor Node.js oculto solo si el puerto no esta respondiendo aun
    if (-not (Test-ServerReady $AppUrl)) {
        $NodeProc = Start-Process `
            -FilePath $NodePath `
            -ArgumentList 'server.js' `
            -WorkingDirectory $ProjectDir `
            -WindowStyle Hidden `
            -RedirectStandardOutput $StdOutLog `
            -RedirectStandardError $StdErrLog `
            -PassThru

        $StartedByLauncher = $true

        # Espera inteligente hasta 12 segundos (48 x 250ms)
        $ready = $false
        for ($i = 0; $i -lt 48; $i++) {
            if ($NodeProc.HasExited) {
                break
            }
            if (Test-ServerReady $AppUrl) {
                $ready = $true
                break
            }
            Start-Sleep -Milliseconds 250
        }

        if (-not $ready) {
            $errHint = ''
            if (Test-Path $StdErrLog) {
                $errText = (Get-Content -Path $StdErrLog -Tail 8 -ErrorAction SilentlyContinue) -join "`n"
                if ($errText -match 'MySQL|ECONNREFUSED|3306') {
                    $errHint = "`n`nVerifica que el servicio de MySQL est${eAccent} iniciado."
                }
            }
            Show-AppError "No se pudo iniciar el servidor de $AppTitle en $AppUrl.$errHint`n`nRevisa el archivo de registro:`n$StdErrLog"
            exit 1
        }
    }

    # 5. Abrir la aplicacion en modo ventana nativa con perfil dedicado
    $ProfileName = 'SGRH-Tropico56-App'
    $ProfileDir = Join-Path $env:LOCALAPPDATA $ProfileName
    if (-not (Test-Path $ProfileDir)) {
        New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
    }

    $browserArgs = @(
        "--app=$AppUrl",
        "--user-data-dir=`"$ProfileDir`"",
        '--start-maximized',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-mode'
    )

    $BrowserProc = Start-Process -FilePath $BrowserPath -ArgumentList $browserArgs -PassThru

    # Si este lanzador inicio Node.js, esperar al cierre real de la ventana de la app
    if ($StartedByLauncher) {
        $BrowserProc.WaitForExit()

        # Doble verificacion: si Edge/Chrome delego la ventana a un proceso hijo con este mismo perfil,
        # esperar mientras exista alguna ventana activa usando SGRH-Tropico56-App
        Start-Sleep -Milliseconds 600
        $browserExeName = [System.IO.Path]::GetFileName($BrowserPath)
        while ($true) {
            $matchingProcs = Get-CimInstance Win32_Process -Filter "Name = '$browserExeName'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -and $_.CommandLine.Contains($ProfileName) }

            if (-not $matchingProcs) {
                break
            }

            # Verificar si alguno de los procesos de ese perfil aun tiene una ventana visible abierta
            $hasVisibleWindow = $false
            foreach ($mp in $matchingProcs) {
                $p = Get-Process -Id $mp.ProcessId -ErrorAction SilentlyContinue
                if ($p -and $p.MainWindowHandle -ne 0) {
                    $hasVisibleWindow = $true
                    break
                }
            }

            if (-not $hasVisibleWindow) {
                break
            }

            Start-Sleep -Milliseconds 700
        }
    }
}
finally {
    # 6. Cierre limpio del servidor Node.js iniciado por este lanzador
    if ($StartedByLauncher -and $NodeProc) {
        try {
            if (-not $NodeProc.HasExited) {
                Stop-Process -Id $NodeProc.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {
            # Ignorar si ya finalizo
        }
    }
}
