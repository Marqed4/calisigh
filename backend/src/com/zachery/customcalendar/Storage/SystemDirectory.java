package com.zachery.customcalendar.Storage;

import java.io.File;

public class SystemDirectory 
{
    public static File Directory(String filePath) 
    {
        String os = System.getProperty("os.name").toLowerCase();
        String base;

        if (os.contains("win")) {
            base = System.getenv("APPDATA");
        } else if (os.contains("mac")) {
            base = System.getProperty("user.home") + "/Library/Application Support";
        } else {
            base = System.getProperty("user.home") + "/.local/share";
        }

        File workingDirectory = new File(base, "Calisigh");
        workingDirectory.mkdirs();
        return new File(workingDirectory, filePath);
    }

    public static File ObtainFile(String requestedPath)
    {
        try 
        {
            File file = SystemDirectory.Directory(requestedPath);
            file.getParentFile().mkdirs();

            if (!file.exists())
            {
                file.createNewFile();
            }

            return file;
        } 
        catch (Exception e) 
        {
            throw new RuntimeException
            (
                "Failed to create file: " + requestedPath, e
            );
        }
    }

    public static File importSound(File sourceFile) throws Exception
    {
        if (!sourceFile.exists())
            throw new IllegalArgumentException("Source file does not exist: " + sourceFile.getAbsolutePath());

        if (sourceFile.length() == 0)
            throw new IllegalArgumentException("Source file is empty: " + sourceFile.getAbsolutePath());

        File dest = Directory("resources/assets/sounds/" + sourceFile.getName());
        dest.getParentFile().mkdirs();

        java.nio.file.Files.copy(
            sourceFile.toPath(),
            dest.toPath(),
            java.nio.file.StandardCopyOption.REPLACE_EXISTING
        );

        System.out.println("Imported sound: " + dest.getAbsolutePath() + " (" + dest.length() + " bytes)");
        return dest;
    }

    // Copies a picture into Calisigh/Images/Uploads and returns the copy. Files already under the
    // Calisigh folder (for example when an undo re-posts a deleted alarm) are used as they are.
    public static File importImage(File sourceFile)
    {
        if (!sourceFile.isFile())
            throw new IllegalArgumentException("Picture does not exist: " + sourceFile.getAbsolutePath());

        String name = sourceFile.getName().toLowerCase();
        if (!name.matches(".*\\.(png|jpe?g|gif|webp)$"))
            throw new IllegalArgumentException("Pictures must be png, jpg, gif or webp.");

        if (!Database.toStoredPath(sourceFile).equals(sourceFile.getAbsolutePath()))
            return sourceFile;

        File dest = Directory("Images/Uploads/" + System.currentTimeMillis() + "-" + sourceFile.getName());
        dest.getParentFile().mkdirs();
        try
        {
            // repeating an alarm posts the same picture many times; reuse an identical copy
            File[] existing = dest.getParentFile().listFiles();
            if (existing != null)
                for (File f : existing)
                    if (f.length() == sourceFile.length() && java.nio.file.Files.mismatch(f.toPath(), sourceFile.toPath()) == -1)
                        return f;

            java.nio.file.Files.copy(sourceFile.toPath(), dest.toPath());
        }
        catch (java.io.IOException e)
        {
            throw new RuntimeException("Could not copy picture: " + e.getMessage(), e);
        }
        return dest;
    }

    public static void seedDefaultSounds()
    {
        File dest = Directory("resources/assets/sounds/Default Chime.mp3");

        if (dest.exists() && dest.length() > 0)
            return;

        dest.getParentFile().mkdirs();

        try (var in = SystemDirectory.class.getResourceAsStream("/assets/sounds/Default Chime.mp3"))
        {
            if (in == null)
            {
                System.err.println("default chime's missing from the jar. even the sound doesn't want to be here.");
                return;
            }

            java.nio.file.Files.copy(
                in,
                dest.toPath(),
                java.nio.file.StandardCopyOption.REPLACE_EXISTING
            );

            System.out.println("Seeded Default Chime.mp3 (" + dest.length() + " bytes)");
        }
        catch (Exception e)
        {
            e.printStackTrace();
        }
    }
}