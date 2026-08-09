; ====================================================
; HEKKI ASSISTANT - NSIS INSTALLER SCRIPT
; Builds: Hekki-Assistant-Setup.exe
; ====================================================

!include "MUI2.nsh"
!include "FileFunc.nsh"

; General Configuration
Name "Hekki Assistant"
OutFile "dist\Hekki-Assistant-Setup.exe"
InstallDir "$PROGRAMFILES64\Hekki Assistant"
InstallDirRegKey HKCU "Software\HekkiAssistant" ""
RequestExecutionLevel admin

; UI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "mariano\web\static\icons\google-cloud.svg"
!define MUI_UNICON "mariano\web\static\icons\google-cloud.svg"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; Installation Section
Section "Hekki Assistant Core" SecMain
  SetOutPath "$INSTDIR"

  ; Copy compiled application binary
  File "dist\Hekki-Assistant.exe"

  ; Create Desktop Shortcut
  CreateShortCut "$DESKTOP\Hekki Assistant.lnk" "$INSTDIR\Hekki-Assistant.exe" "" "$INSTDIR\Hekki-Assistant.exe" 0

  ; Create Start Menu Entry
  CreateDirectory "$SMPROGRAMS\Hekki Assistant"
  CreateShortCut "$SMPROGRAMS\Hekki Assistant\Hekki Assistant.lnk" "$INSTDIR\Hekki-Assistant.exe" "" "$INSTDIR\Hekki-Assistant.exe" 0
  CreateShortCut "$SMPROGRAMS\Hekki Assistant\Uninstall Hekki Assistant.lnk" "$INSTDIR\uninstall.exe"

  ; Write registry keys for Uninstaller in Control Panel
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\HekkiAssistant" "DisplayName" "Hekki Assistant"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\HekkiAssistant" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\HekkiAssistant" "DisplayIcon" '"$INSTDIR\Hekki-Assistant.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\HekkiAssistant" "Publisher" "Hekki AI"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\HekkiAssistant" "DisplayVersion" "1.4.1"
  
  ; Write Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

; Uninstallation Section
Section "Uninstall"
  Delete "$DESKTOP\Hekki Assistant.lnk"
  Delete "$SMPROGRAMS\Hekki Assistant\Hekki Assistant.lnk"
  Delete "$SMPROGRAMS\Hekki Assistant\Uninstall Hekki Assistant.lnk"
  RMDir "$SMPROGRAMS\Hekki Assistant"

  Delete "$INSTDIR\Hekki-Assistant.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\HekkiAssistant"
  DeleteRegKey HKCU "Software\HekkiAssistant"
SectionEnd
