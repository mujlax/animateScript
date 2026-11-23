$ErrorActionPreference = 'Stop'
$bundleId = 'com.bonodigital.timelinehelper'
$extensionsDir = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Adobe\CEP\extensions'
$targetDir = Join-Path $extensionsDir $bundleId
$stageDir = $null
$backupDir = $null

function Test-TimelineHelperManifest($folder) {
    $manifestPath = Join-Path $folder 'CSXS\manifest.xml'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { return $false }
    [xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw
    return $manifest.ExtensionManifest.ExtensionBundleId -eq $bundleId
}

try {
    foreach ($item in @('CSXS\manifest.xml', 'dist\index.html', 'dist\app.js', 'dist\CSInterface.js', 'jsfl\DuplicateLayerToGuideAndBitmap.jsfl', 'jsx\AutoImageTrace.jsx', 'jsx\AutoImageTraceHandler.jsx')) {
        if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $item) -PathType Leaf)) {
            throw "Missing $item. Keep the entire Timeline Helper folder together."
        }
    }
    if (-not (Test-TimelineHelperManifest $PSScriptRoot)) { throw 'Invalid Timeline Helper manifest.' }
    if (Get-Process -Name Animate, Illustrator -ErrorAction SilentlyContinue) {
        throw 'Quit Adobe Animate and Illustrator before installing.'
    }

    $sourcePath = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
    $targetPath = [IO.Path]::GetFullPath($targetDir).TrimEnd('\') + '\'
    $targetItem = Get-Item -LiteralPath $targetDir -Force -ErrorAction SilentlyContinue
    if ($targetItem -and ($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'The installation folder is a link.'
    }

    $installInPlace = $sourcePath.Equals($targetPath, [StringComparison]::OrdinalIgnoreCase)
    if (-not $installInPlace) {
        if ($sourcePath.StartsWith($targetPath, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Move the source folder outside the installation folder.'
        }
        if ($targetItem) {
            if (-not (Test-TimelineHelperManifest $targetDir)) { throw 'The destination belongs to another project.' }
            if (Test-Path -LiteralPath (Join-Path $targetDir '.git')) {
                throw 'The destination is a Git checkout. Run its own installer.'
            }
        }
        New-Item -ItemType Directory -Path $extensionsDir -Force | Out-Null
        $stageDir = Join-Path $extensionsDir ('.timelinehelper-install.' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $stageDir | Out-Null
        foreach ($item in @('CSXS', 'dist', 'jsfl', 'jsx', 'Install-macOS.command', 'Install-Windows.cmd', 'Install-Windows.ps1')) {
            $entry = Get-Item -LiteralPath (Join-Path $PSScriptRoot $item) -Force
            if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
                ($entry.PSIsContainer -and (Get-ChildItem -LiteralPath $entry.FullName -Recurse -Force -Attributes ReparsePoint))) {
                throw "The installer source contains a link in $item."
            }
            Copy-Item -LiteralPath $entry.FullName -Destination $stageDir -Recurse
        }
    }

    foreach ($version in 8..12) {
        $key = "HKCU:\Software\Adobe\CSXS.$version"
        if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key | Out-Null }
        New-ItemProperty -LiteralPath $key -Name PlayerDebugMode -PropertyType String -Value '1' -Force | Out-Null
    }

    if ($stageDir) {
        if ($targetItem) {
            $backupRoot = Join-Path (Split-Path -Parent $extensionsDir) ('timelinehelper-backup.' + [guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Path $backupRoot | Out-Null
            $backupDir = Join-Path $backupRoot $bundleId
            Move-Item -LiteralPath $targetDir -Destination $backupDir
        }
        Move-Item -LiteralPath $stageDir -Destination $targetDir
        $stageDir = $null
    }

    Write-Host "Timeline Helper is ready at $targetDir"
    if ($backupDir) { Write-Host "Previous installation saved at $backupDir" }
    Write-Host 'Start Animate or Illustrator and open Window > Extensions > Timeline Helper.'
} catch {
    if ($backupDir -and (Test-Path -LiteralPath $backupDir) -and -not (Test-Path -LiteralPath $targetDir)) {
        Move-Item -LiteralPath $backupDir -Destination $targetDir
    }
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    if ($stageDir -and (Test-Path -LiteralPath $stageDir)) {
        Remove-Item -LiteralPath $stageDir -Recurse -Force
    }
}
