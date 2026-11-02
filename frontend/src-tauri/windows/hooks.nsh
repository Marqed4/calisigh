; NSIS hooks for the Calisigh installer (see bundle.windows.nsis.installerHooks in tauri.conf.json).
; Offers to install Ollama, which runs Calisigh's chat agent, and puts both apps on the desktop.

!define OLLAMA_URL "https://ollama.com/download/OllamaSetup.exe"

Function CalisighInstallOllama
  IfFileExists "$LOCALAPPDATA\Programs\Ollama\ollama.exe" ollama_ready 0

  MessageBox MB_YESNO|MB_ICONQUESTION "Calisigh's chat agent runs on Ollama, a free AI engine that stays on your computer.$\r$\n$\r$\nInstall Ollama now? It is a download of about 1 GB, so it can take a few minutes." /SD IDYES IDYES download IDNO done

download:
  DetailPrint "Downloading Ollama (about 1 GB), this can take a few minutes..."
  Delete "$TEMP\OllamaSetup.exe"
  nsExec::ExecToLog '"$SYSDIR\curl.exe" -L --fail --retry 3 --retry-delay 3 -sS -o "$TEMP\OllamaSetup.exe" "${OLLAMA_URL}"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "curl failed ($0), trying PowerShell..."
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $$ProgressPreference = $\'SilentlyContinue$\'; Invoke-WebRequest -UseBasicParsing -Uri ${OLLAMA_URL} -OutFile $\'$TEMP\OllamaSetup.exe$\'"'
    Pop $0
  ${EndIf}
  ${If} $0 != 0
    DetailPrint "Could not download Ollama."
    MessageBox MB_OK|MB_ICONEXCLAMATION "Ollama could not be downloaded, so the chat agent will not work yet.$\r$\n$\r$\nCalisigh is installed. You can get Ollama later from https://ollama.com/download." /SD IDOK
    Goto done
  ${EndIf}

  DetailPrint "Installing Ollama..."
  ExecWait '"$TEMP\OllamaSetup.exe" /SILENT /NORESTART' $0
  Delete "$TEMP\OllamaSetup.exe"
  IfFileExists "$LOCALAPPDATA\Programs\Ollama\ollama.exe" ollama_ready 0
  DetailPrint "Ollama installer finished with code $0 but Ollama was not found."
  MessageBox MB_OK|MB_ICONEXCLAMATION "Ollama did not finish installing, so the chat agent will not work yet.$\r$\n$\r$\nCalisigh is installed. You can get Ollama later from https://ollama.com/download." /SD IDOK
  Goto done

ollama_ready:
  DetailPrint "Adding Ollama to the desktop..."
  CreateShortcut "$DESKTOP\Ollama.lnk" "$LOCALAPPDATA\Programs\Ollama\ollama app.exe"
  ; start it now so Calisigh finds the server the first time it opens
  Exec '"$LOCALAPPDATA\Programs\Ollama\ollama app.exe"'

done:
FunctionEnd

; Holidays come from Calendarific, which needs a free key of the user's own. The key is pasted into Calisigh
; (a prompt on first launch, or Settings), so here the installer only offers to open the sign-up page.
Function CalisighOfferHolidayKey
  MessageBox MB_YESNO|MB_ICONQUESTION "Calisigh can show national holidays and observances on your calendar.$\r$\n$\r$\nThey come from Calendarific, a free service, and you need your own free key (about two minutes).$\r$\n$\r$\nOpen the Calendarific sign-up page now? When you open Calisigh it will ask you to paste the key." /SD IDNO IDYES open_signup IDNO skip_signup

open_signup:
  ExecShell "open" "https://calendarific.com/signup"

skip_signup:
FunctionEnd

!macro NSIS_HOOK_POSTINSTALL
  Call CreateOrUpdateDesktopShortcut
  Call CalisighInstallOllama
  Call CalisighOfferHolidayKey
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Ollama itself stays, other programs may use it
  Delete "$DESKTOP\Ollama.lnk"
!macroend
