package com.zachery.customcalendar;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.PrintWriter;

import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;

import javazoom.jl.player.advanced.AdvancedPlayer;

public class AlarmActivation
{
    String title;
    String desc;

    public AlarmActivation(String title, String desc)
    {
        this.title = title;
        this.desc = desc;
    }

    public static void testSound()
    {
        File f = SystemDirectory.Directory("resources/assets/sounds/Default Chime.mp3");
        System.out.println("Exists: " + f.exists());
        System.out.println("Size: " + f.length() + " bytes");
        System.out.println("Can read: " + f.canRead());

        try (FileInputStream fis = new FileInputStream(f))
        {
            AdvancedPlayer player = new AdvancedPlayer(fis);
            System.out.println("Player created, playing...");
            player.play();
            System.out.println("Done playing.");
        }
        catch (Exception e)
        {
            e.printStackTrace();
        }
    }

    public AlarmActivation displayTray() throws Exception
    {
        String os = System.getProperty("os.name").toLowerCase();

        if (os.contains("win"))
            displayWindows();
        else if (os.contains("mac"))
            displayMac();
        else
            displayLinux();

        return this;
    }

    private void displayWindows() throws Exception
    {
        System.out.println("Displaying Windows Toast Notification...");

        String safeTitle = sanitize(title);
        String safeDesc  = sanitize(desc);

        File tempDir = SystemDirectory.Directory("temp");
        tempDir.mkdirs();
        File psFile = new File(tempDir, "toast_" + System.currentTimeMillis() + ".ps1");

        try (PrintWriter pw = new PrintWriter(new FileWriter(psFile)))
        {
            pw.println("[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null");
            pw.println("[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime] | Out-Null");
            pw.println("[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null");

            pw.println("$xml = '<toast>" +
                "<visual><binding template=\"ToastGeneric\">" +
                "<text>" + safeTitle + "</text>" +
                "<text>" + safeDesc + "</text>" +
                "</binding></visual>" +
                "<audio silent=\"true\"/>" +
                "<actions>" +
                "<action content=\"Stop\" arguments=\"stop\" activationType=\"background\"/>" +
                "</actions>" +
                "</toast>'");

            pw.println("$doc = [Windows.Data.Xml.Dom.XmlDocument]::new()");
            pw.println("$doc.LoadXml($xml)");
            pw.println("$toast = [Windows.UI.Notifications.ToastNotification]::new($doc)");
            pw.println("$toast.ExpirationTime = [System.DateTimeOffset]::Now.AddMinutes(5)");

            // Use Register-ObjectEvent
            pw.println("$global:toastDone = $false");
            pw.println("Register-ObjectEvent -InputObject $toast -EventName Activated -Action {");
            pw.println("    try { Invoke-RestMethod -Uri 'http://localhost:4567/api/sounds/stop' -Method Post | Out-Null } catch {}");
            pw.println("    $global:toastDone = $true");
            pw.println("} | Out-Null");
            pw.println("Register-ObjectEvent -InputObject $toast -EventName Dismissed -Action {");
            pw.println("    $global:toastDone = $true");
            pw.println("} | Out-Null");
            pw.println("Register-ObjectEvent -InputObject $toast -EventName Failed -Action {");
            pw.println("    $global:toastDone = $true");
            pw.println("} | Out-Null");

            pw.println("[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('com.zachery.calisigh').Show($toast)");

            // Poll
            pw.println("$timeout = [System.DateTime]::Now.AddMinutes(5)");
            pw.println("while (-not $global:toastDone -and [System.DateTime]::Now -lt $timeout) {");
            pw.println("    Start-Sleep -Milliseconds 500");
            pw.println("}");
        }

        File ref = psFile;
        new ProcessBuilder("powershell", "-ExecutionPolicy", "Bypass", "-File", psFile.getAbsolutePath())
            .inheritIO()
            .start();

        new Thread(() -> {
            try { Thread.sleep(6 * 60 * 1000); ref.delete(); } catch (Exception ignored) {}
        }).start();

        System.out.println("Toast Notification Sent!!!");
    }

    private void displayMac() throws Exception
    {
        System.out.println("Displaying macOS Notification...");

        String safeTitle = title.replace("\"", "\\\"");
        String safeDesc  = desc.replace("\"", "\\\"");

        String script = String.format(
            "display notification \"%s\" with title \"%s\"",
            safeDesc, safeTitle
        );

        ProcessBuilder pb = new ProcessBuilder("osascript", "-e", script);
        pb.inheritIO();
        int exitCode = pb.start().waitFor();
        System.out.println("macOS notification exit code: " + exitCode);
    }

    private void displayLinux() throws Exception
    {
        System.out.println("Displaying Linux Notification...");
        ProcessBuilder pb = new ProcessBuilder("notify-send", title, desc);
        pb.inheritIO();
        int exitCode = pb.start().waitFor();
        System.out.println("Linux notification exit code: " + exitCode);
    }

    private String sanitize(String input)
    {
        if (input == null) return "";
        return input
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;");
    }

    public AlarmActivation playSound(String soundPath)
    {
        try
        {
            File soundFile = (soundPath != null && !soundPath.isEmpty())
                ? new File(soundPath)
                : SystemDirectory.Directory("resources/assets/sounds/Default Chime.mp3");

            System.out.println("Looking for sound at: " + soundFile.getAbsolutePath());
            System.out.println("File exists: " + soundFile.exists());

            if (!soundFile.exists())
            {
                System.err.println("sound file's not there. shocker. " + soundFile.getAbsolutePath());
                return this;
            }

            String name = soundFile.getName().toLowerCase();

            if (name.endsWith(".wav"))
                playWav(soundFile);
            else if (name.endsWith(".mp3"))
                playMp3(soundFile);
            else
                System.err.println("unsupported format. nobody asked me though. " + name);
        }
        catch (Exception e)
        {
            e.printStackTrace();
        }

        return this;
    }

    private void playWav(File soundFile)
    {
        Thread t = new Thread(() ->
        {
            Clip clip = null;
            try (AudioInputStream ais = AudioSystem.getAudioInputStream(soundFile))
            {
                clip = AudioSystem.getClip();
                clip.open(ais);
                clip.start();

                long durationMs = clip.getMicrosecondLength() / 1000;
                Thread.sleep(durationMs + 200);
            }
            catch (InterruptedException e)
            {
                Thread.currentThread().interrupt();
            }
            catch (Exception e)
            {
                e.printStackTrace();
            }
            finally
            {
                if (clip != null) {
                    clip.stop();
                    clip.close();
                }
            }
        });
        t.setDaemon(false);
        t.start();
    }

    private void playMp3(File soundFile)
    {
        Thread t = new Thread(() ->
        {
            try (FileInputStream fis = new FileInputStream(soundFile))
            {
                AdvancedPlayer player = new AdvancedPlayer(fis);
                System.out.println("Player created, playing...");
                player.play();
                System.out.println("Done playing.");
            }
            catch (Exception e)
            {
                e.printStackTrace();
            }
        });
        t.setDaemon(false);
        t.start();
        try { t.join(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}