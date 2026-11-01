package com.zachery.customcalendar.Media;

import com.zachery.customcalendar.Storage.Database;
import com.zachery.customcalendar.Storage.SystemDirectory;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;
import javax.sound.sampled.DataLine;
import javax.sound.sampled.FloatControl;
import javax.sound.sampled.SourceDataLine;

import javazoom.jl.decoder.Bitstream;
import javazoom.jl.decoder.Decoder;
import javazoom.jl.decoder.Header;
import javazoom.jl.decoder.SampleBuffer;

/*
The sound list, the selected sound and the volume live in SQLite now (sounds + settings tables).
Uploaded files stay on disk under Calisigh/AlarmSounds/Uploads; the table keeps each file's path
relative to the Calisigh folder. The API still hands out "name|&absolute path" strings.
*/
public class AlarmSounds
{
    private static final String SETTING_SELECTED = "selectedSound";
    private static final String SETTING_VOLUME = "volume";

    private final Database db;
    private Thread currentPlayback;
    private Clip currentClip;
    private SourceDataLine currentLine;
    private String selectedSound = null;
    private float volume = 1.0f;

    public AlarmSounds() throws SQLException
    {
        this.db = Database.get();
        loadSelectedSound();
        loadVolume();
    }

    private void loadSelectedSound() throws SQLException
    {
        String s = db.getSetting(SETTING_SELECTED);
        selectedSound = (s == null || s.isBlank()) ? null : s;
    }

    private void loadVolume() throws SQLException
    {
        String s = db.getSetting(SETTING_VOLUME);
        if (s == null) return;

        try {
            float val = Float.parseFloat(s.trim());
            volume = Math.max(0f, Math.min(1f, val));
        } catch (NumberFormatException e) {
            volume = 1.0f;
        }
    }

    public void addSound(String sourcePath) throws IOException, SQLException
    {
        File sourceFile = new File(sourcePath);

        if (!sourceFile.exists())
            throw new IOException("Source file does not exist: " + sourcePath);

        String fileName = sourceFile.getName();
        int dot = fileName.lastIndexOf('.');
        String ext = dot < 0 ? "" : fileName.substring(dot).toLowerCase();

        if (!ext.equals(".mp3") && !ext.equals(".wav"))
            throw new IOException("Unsupported file type: " + ext);

        String displayName = fileName.substring(0, dot);

        File destFile = SystemDirectory.Directory("AlarmSounds/Uploads/" + fileName);

        //names are unique now; same name pointing at a different file would be silently ignored otherwise
        Database.MediaRow existing = db.findMedia(Database.SOUNDS, displayName);
        if (existing != null
            && !Database.fromStoredPath(existing.path()).getAbsoluteFile().equals(destFile.getAbsoluteFile()))
            throw new IOException("A sound named \"" + displayName + "\" already exists");

        destFile.getParentFile().mkdirs();
        Files.copy(sourceFile.toPath(), destFile.toPath(), StandardCopyOption.REPLACE_EXISTING);

        if (existing == null)
            db.addMedia(Database.SOUNDS, displayName, Database.toStoredPath(destFile));
    }

    public void playSound(String name)
    {
        if (name == null || name.equals("chime") || name.isEmpty())
        {
            playSoundFile(null);
            return;
        }

        Database.MediaRow row;
        try {
            row = db.findMedia(Database.SOUNDS, name);
        } catch (SQLException e) {
            System.err.println("couldn't look up the sound. the database is sulking. " + e.getMessage());
            return;
        }

        if (row == null)
        {
            System.out.println("Sound not found: " + name);
            return;
        }

        playSoundFile(Database.fromStoredPath(row.path()).getAbsolutePath());
    }

    private void playSoundFile(String filePath)
    {
        stopSound();

        try
        {
            File soundFile = (filePath != null && !filePath.isEmpty())
                ? new File(filePath)
                : SystemDirectory.Directory("resources/assets/sounds/Default Chime.mp3");

            if (!soundFile.exists())
            {
                System.err.println("can't find the sound file. it's just gone. " + soundFile.getAbsolutePath());
                return;
            }

            String name = soundFile.getName().toLowerCase();

            if (name.endsWith(".mp3"))
            {
                File ref = soundFile;
                currentPlayback = new Thread(() -> playMp3(ref));
            }
            else if (name.endsWith(".wav"))
            {
                File ref = soundFile;
                currentPlayback = new Thread(() -> playWav(ref));
            }
            else
            {
                System.err.println("unsupported format, obviously: " + name);
                return;
            }

            currentPlayback.setDaemon(true);
            currentPlayback.start();
        }
        catch (Exception e)
        {
            System.err.println("couldn't play the sound. nothing ever works. " + e.getMessage());
        }
    }

    private void playMp3(File file)
    {
        try (FileInputStream fis = new FileInputStream(file))
        {
            Bitstream bitstream = new Bitstream(fis);
            Decoder decoder = new Decoder();
            SourceDataLine line = null;

            try
            {
                while (!Thread.currentThread().isInterrupted())
                {
                    Header header = bitstream.readFrame();
                    if (header == null) break;

                    SampleBuffer output = (SampleBuffer) decoder.decodeFrame(header, bitstream);

                    if (line == null)
                    {
                        AudioFormat format = new AudioFormat(
                            AudioFormat.Encoding.PCM_SIGNED,
                            output.getSampleFrequency(),
                            16,
                            output.getChannelCount(),
                            output.getChannelCount() * 2,
                            output.getSampleFrequency(),
                            false
                        );
                        DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
                        line = (SourceDataLine) AudioSystem.getLine(info);
                        line.open(format);
                        synchronized (this) {
                            currentLine = line;
                        }
                        applyVolumeToLine(line, getVolume());
                        line.start();
                    }

                    short[] samples = output.getBuffer();
                    int length = output.getBufferLength();
                    byte[] bytes = new byte[length * 2];

                    for (int i = 0; i < length; i++)
                    {
                        bytes[i * 2]     = (byte) (samples[i] & 0xFF);
                        bytes[i * 2 + 1] = (byte) ((samples[i] >> 8) & 0xFF);
                    }

                    line.write(bytes, 0, bytes.length);
                    bitstream.closeFrame();
                }

                if (line != null) line.drain();
            }
            finally
            {
                synchronized (this) {
                    if (currentLine != null) {
                        currentLine.stop();
                        currentLine.close();
                        currentLine = null;
                    }
                }
                try { bitstream.close(); } catch (Exception ignored) {}
            }
        }
        catch (Exception e)
        {
            if (!Thread.currentThread().isInterrupted())
                System.err.println("mp3 broke mid-song. of course it did. " + e.getMessage());
        }
    }

    private void playWav(File file)
    {
        try (AudioInputStream ais = AudioSystem.getAudioInputStream(file))
        {
            synchronized (this) {
                currentClip = AudioSystem.getClip();
            }
            currentClip.open(ais);
            applyVolumeToClip(currentClip, getVolume());
            currentClip.start();

            long durationMs = currentClip.getMicrosecondLength() / 1000;
            Thread.sleep(durationMs);
        }
        catch (InterruptedException e)
        {
            Thread.currentThread().interrupt();
        }
        catch (Exception e)
        {
            if (!Thread.currentThread().isInterrupted())
                System.err.println("wav broke too. figures. " + e.getMessage());
        }
        finally
        {
            synchronized (this) {
                if (currentClip != null) {
                    currentClip.stop();
                    currentClip.close();
                    currentClip = null;
                }
            }
        }
    }

    private float toDecibels(float vol)
    {
        if (vol <= 0f) return -80f;
        float curved = vol * vol;
        return 20f * (float) Math.log10(curved);
    }

    private void applyVolumeToClip(Clip clip, float vol)
    {
        try
        {
            FloatControl gain = (FloatControl) clip.getControl(FloatControl.Type.MASTER_GAIN);
            float dB = toDecibels(vol);
            gain.setValue(Math.max(gain.getMinimum(), Math.min(gain.getMaximum(), dB)));
        }
        catch (Exception e)
        {
            System.err.println("can't even control the volume. whatever. " + e.getMessage());
        }
    }

    private void applyVolumeToLine(SourceDataLine line, float vol)
    {
        try
        {
            FloatControl gain = (FloatControl) line.getControl(FloatControl.Type.MASTER_GAIN);
            float dB = toDecibels(vol);
            gain.setValue(Math.max(gain.getMinimum(), Math.min(gain.getMaximum(), dB)));
        }
        catch (Exception e)
        {
            System.err.println("can't even control the volume. whatever. " + e.getMessage());
        }
    }

    public void stopSound()
    {
        synchronized (this) {
            if (currentClip != null) {
                currentClip.stop();
                currentClip.close();
                currentClip = null;
            }
            if (currentLine != null) {
                currentLine.stop();
                currentLine.close();
                currentLine = null;
            }
        }
        if (currentPlayback != null && currentPlayback.isAlive())
        {
            currentPlayback.interrupt();
            currentPlayback = null;
        }
    }

    public void removeSound(String name) throws IOException, SQLException
    {
        Database.MediaRow row = db.findMedia(Database.SOUNDS, name);

        if (row == null)
        {
            System.out.println("Sound not found: " + name);
            return;
        }

        File uploadedFile = Database.fromStoredPath(row.path());
        if (uploadedFile.exists())
            uploadedFile.delete();

        db.removeMedia(Database.SOUNDS, name);
    }

    public void setVolume(float vol) throws SQLException
    {
        volume = Math.max(0f, Math.min(1f, vol));

        synchronized (this) {
            if (currentClip != null && currentClip.isOpen())
                applyVolumeToClip(currentClip, volume);
            if (currentLine != null && currentLine.isOpen())
                applyVolumeToLine(currentLine, volume);
        }

        db.setSetting(SETTING_VOLUME, String.valueOf(volume));
    }

    public float getVolume()
    {
        return volume;
    }

    /** "name|&absolute path" strings, sorted, same shape the frontend always got. */
    public List<String> getAllSounds() throws SQLException
    {
        List<String> out = new ArrayList<>();
        for (Database.MediaRow r : db.listMedia(Database.SOUNDS))
            out.add(r.name() + "|&" + Database.fromStoredPath(r.path()).getAbsolutePath());

        Collections.sort(out);
        return out;
    }

    public static String getDisplayName(String entry)
    {
        return entry.split("\\|&", 2)[0];
    }

    public static String getFilePath(String entry)
    {
        String[] parts = entry.split("\\|&", 2);
        return parts.length == 2 ? parts[1] : "";
    }

    public void selectSound(String name) throws SQLException
    {
        selectedSound = (name == null || name.isEmpty()) ? null : name;
        db.setSetting(SETTING_SELECTED, selectedSound);
    }

    public String getSelectedSound()
    {
        return selectedSound;
    }
}
